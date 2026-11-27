import { NextFunction, Response, Router } from 'express';
import Joi from 'joi';
import { PoolClient } from 'pg';
import { query, transaction } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';
import { mensagens, validate } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';
import { dataBR, dataHora, dataLocalISO, FUSO_APLICACAO } from '../utils/datas';

/**
 * Reservas e empréstimos de veículos POOL (Sprint 02).
 *
 * Regras combinadas com o Departamento de Frotas:
 *  - o próprio Departamento de Frotas registra a reserva ou o empréstimo (não há etapa de aprovação);
 *  - somente veículos POOL podem ser reservados (veículos de uso atribuído ficam de fora);
 *  - somente condutores liberados para o POOL; CNH vencida bloqueia o registro.
 * Requisito do projeto (CA04): o mesmo veículo não pode ter reservas ou empréstimos com períodos sobrepostos.
 * Decisões técnicas da equipe, a confirmar na validação: veículo em manutenção ou indisponível não é
 * reservado, a CNH precisa valer até o fim do período e períodos encostados são aceitos
 * (ver docs/sprint-02/REGRAS_RESERVAS.md).
 * Todas as regras são verificadas no servidor, dentro de uma transação que bloqueia o veículo,
 * para que dois registros simultâneos não ocupem o mesmo período.
 */
const router = Router();

export const TIPOS_RESERVA = ['reserva', 'emprestimo'] as const;
export const STATUS_RESERVA = ['agendada', 'em_uso', 'cancelada', 'concluida'] as const;

/** Tolerância para considerar que uma reserva "começa agora" (diferença entre relógios). */
const TOLERANCIA_MS = 2 * 60 * 1000;
/** Antecedência máxima para registrar uma reserva. */
const ANTECEDENCIA_MAXIMA_DIAS = 365;

const uuid = Joi.string().guid({ version: ['uuidv4'] });

const criarSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_RESERVA).required().label('Tipo'),
  veiculo_id: uuid.required().label('Veículo'),
  condutor_id: uuid.required().label('Condutor'),
  inicio: Joi.date().iso().label('Início').when('tipo', { is: 'reserva', then: Joi.required(), otherwise: Joi.forbidden() }),
  fim_previsto: Joi.date().iso().required().label('Previsão de devolução'),
  finalidade: Joi.string().trim().min(3).max(200).required().label('Finalidade'),
  observacoes: Joi.string().trim().max(500).allow('', null).label('Observações'),
}).messages({ ...mensagens, 'any.unknown': 'O campo {#label} não deve ser informado para empréstimos (a retirada é imediata).' });

const cancelarSchema = Joi.object({
  motivo: Joi.string().trim().min(5).max(300).required().label('Motivo do cancelamento'),
}).messages(mensagens);

const idSchema = Joi.object({ id: uuid.required().label('Identificador') }).messages(mensagens);

const listarSchema = Joi.object({
  busca: Joi.string().trim().max(60).allow('').label('Busca'),
  status: Joi.string().valid(...STATUS_RESERVA).label('Status'),
  tipo: Joi.string().valid(...TIPOS_RESERVA).label('Tipo'),
  veiculo_id: uuid.label('Veículo'),
  condutor_id: uuid.label('Condutor'),
}).messages(mensagens);

const disponibilidadeSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_RESERVA).default('reserva').label('Tipo'),
  inicio: Joi.date().iso().label('Início').when('tipo', { is: 'reserva', then: Joi.required() }),
  fim: Joi.date().iso().required().label('Previsão de devolução'),
}).messages(mensagens);

/**
 * Período efetivamente ocupado por uma reserva ativa:
 *  - começa na retirada, se ela ocorreu antes do início previsto;
 *  - um empréstimo em uso e atrasado continua ocupando o veículo até a devolução.
 */
const INICIO_OCUPADO = 'LEAST(r.inicio, COALESCE(r.retirada_em, r.inicio))';
const FIM_OCUPADO = `CASE WHEN r.status = 'em_uso' THEN GREATEST(r.fim_previsto, NOW()) ELSE r.fim_previsto END`;

const SELECT_RESERVA = `
  SELECT r.id, r.numero, r.tipo, r.status, r.inicio, r.fim_previsto, r.retirada_em, r.devolvida_em,
         r.finalidade, r.observacoes, r.motivo_cancelamento, r.criado_em, r.atualizado_em,
         (r.status = 'em_uso' AND r.fim_previsto < NOW()) AS atrasada,
         json_build_object('id', v.id, 'codigo', v.codigo, 'placa', v.placa, 'marca', v.marca, 'modelo', v.modelo) AS veiculo,
         json_build_object('id', c.id, 'nome', c.nome, 'matricula', c.matricula) AS condutor
    FROM reservas r
    JOIN veiculos v ON v.id = r.veiculo_id
    JOIN condutores c ON c.id = r.condutor_id`;

const ORDEM = `array_position(ARRAY['em_uso', 'agendada', 'concluida', 'cancelada']::varchar[], r.status), r.inicio`;

router.use(authenticate);

/** GET /api/reservas — lista reservas e empréstimos com busca e filtros. */
router.get('/', authorize('reservas:consultar'), validate(listarSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { busca, status, tipo, veiculo_id, condutor_id } = req.query as Record<string, string | undefined>;
      const filtros: string[] = ['TRUE'];
      const params: unknown[] = [];

      if (busca) {
        params.push(`%${busca.replace(/[%_\\]/g, '\\$&')}%`);
        const p = `$${params.length}`;
        filtros.push(`(v.placa ILIKE ${p} OR v.codigo ILIKE ${p} OR v.modelo ILIKE ${p} OR c.nome ILIKE ${p}
                       OR c.matricula ILIKE ${p} OR r.finalidade ILIKE ${p} OR r.numero::text = $${params.length + 1})`);
        params.push(busca.replace(/^#?0*/, ''));
      }
      if (status) { params.push(status); filtros.push(`r.status = $${params.length}`); }
      if (tipo) { params.push(tipo); filtros.push(`r.tipo = $${params.length}`); }
      if (veiculo_id) { params.push(veiculo_id); filtros.push(`r.veiculo_id = $${params.length}`); }
      if (condutor_id) { params.push(condutor_id); filtros.push(`r.condutor_id = $${params.length}`); }

      const { rows } = await query(`${SELECT_RESERVA} WHERE ${filtros.join(' AND ')} ORDER BY ${ORDEM}`, params);
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/reservas/resumo — totais para os indicadores da tela. */
router.get('/resumo', authorize('reservas:consultar'),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query<Record<string, string>>(
        `SELECT COUNT(*) FILTER (WHERE status = 'agendada') AS agendadas,
                COUNT(*) FILTER (WHERE status = 'em_uso') AS em_uso,
                COUNT(*) FILTER (WHERE status = 'em_uso' AND fim_previsto < NOW()) AS atrasadas,
                COUNT(*) FILTER (WHERE status = 'agendada'
                                   AND (inicio AT TIME ZONE '${FUSO_APLICACAO}')::date = (NOW() AT TIME ZONE '${FUSO_APLICACAO}')::date) AS retiradas_hoje
           FROM reservas`
      );
      const r = rows[0];
      res.json({
        success: true,
        data: {
          agendadas: Number(r.agendadas),
          em_uso: Number(r.em_uso),
          atrasadas: Number(r.atrasadas),
          retiradas_hoje: Number(r.retiradas_hoje),
        },
      });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/reservas/disponibilidade — veículos POOL livres para o período informado. */
router.get('/disponibilidade', authorize('reservas:consultar'), validate(disponibilidadeSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as { tipo: string; inicio?: Date; fim: Date };
      const inicio = q.tipo === 'emprestimo' ? new Date() : q.inicio!;
      const fim = q.fim;
      if (fim <= inicio) throw new AppError(422, 'A previsão de devolução deve ser posterior ao início.');

      const situacoes = q.tipo === 'emprestimo' ? ['disponivel'] : ['disponivel', 'em_uso'];
      const { rows } = await query(
        `SELECT v.id, v.codigo, v.placa, v.marca, v.modelo, v.tipo, v.unidade, v.situacao
           FROM veiculos v
          WHERE v.ativo = TRUE AND v.modalidade = 'pool' AND v.situacao = ANY($3::varchar[])
            AND NOT EXISTS (
                SELECT 1 FROM reservas r
                 WHERE r.veiculo_id = v.id AND r.status IN ('agendada', 'em_uso')
                   AND ${INICIO_OCUPADO} < $2 AND ${FIM_OCUPADO} > $1)
          ORDER BY v.codigo`,
        [inicio, fim, situacoes]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/reservas/:id — consulta uma reserva com o registro de eventos. */
router.get('/:id', authorize('reservas:consultar'), validate(idSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query(`${SELECT_RESERVA} WHERE r.id = $1`, [req.params.id]);
      if (!rows[0]) throw new AppError(404, 'Reserva não encontrada.');
      const eventos = await query(
        `SELECT e.evento, e.observacao, e.criado_em, u.nome AS usuario
           FROM reserva_eventos e LEFT JOIN usuarios u ON u.id = e.usuario_id
          WHERE e.reserva_id = $1 ORDER BY e.criado_em, e.id`,
        [req.params.id]
      );
      res.json({ success: true, data: { ...rows[0], eventos: eventos.rows } });
    } catch (error) {
      next(error);
    }
  });

/** POST /api/reservas — registra uma reserva (futura) ou um empréstimo (retirada imediata). */
router.post('/', authorize('reservas:gerenciar'), validate(criarSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const d = req.body as {
        tipo: 'reserva' | 'emprestimo'; veiculo_id: string; condutor_id: string;
        inicio?: Date; fim_previsto: Date; finalidade: string; observacoes?: string;
      };
      const agora = new Date();
      const inicio = d.tipo === 'emprestimo' ? agora : d.inicio!;

      if (d.tipo === 'reserva' && inicio.getTime() < agora.getTime() - TOLERANCIA_MS) {
        throw new AppError(422, 'O início da reserva não pode estar no passado. Para uma retirada agora, registre um empréstimo.');
      }
      if (d.tipo === 'reserva' && inicio.getTime() > agora.getTime() + ANTECEDENCIA_MAXIMA_DIAS * 86_400_000) {
        throw new AppError(422, `A reserva pode ser registrada com até ${ANTECEDENCIA_MAXIMA_DIAS} dias de antecedência.`);
      }
      if (d.fim_previsto <= inicio) {
        throw new AppError(422, 'A previsão de devolução deve ser posterior ao início.');
      }

      const id = await transaction(async (client) => {
        const veiculo = await validarVeiculo(client, d.veiculo_id, d.tipo === 'emprestimo');
        await validarCondutor(client, d.condutor_id, d.fim_previsto);
        await verificarConflito(client, veiculo.id, inicio, d.fim_previsto);

        const status = d.tipo === 'emprestimo' ? 'em_uso' : 'agendada';
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO reservas (tipo, veiculo_id, condutor_id, inicio, fim_previsto, retirada_em, finalidade,
                                 observacoes, status, criado_por, atualizado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
          [d.tipo, veiculo.id, d.condutor_id, inicio, d.fim_previsto, d.tipo === 'emprestimo' ? agora : null,
            d.finalidade, d.observacoes || null, status, req.usuario!.id]
        );
        const reservaId = rows[0].id;
        await registrarEvento(client, reservaId, 'registro', req.usuario!.id,
          d.tipo === 'emprestimo' ? 'Empréstimo registrado com retirada imediata.' : 'Reserva registrada.');

        if (d.tipo === 'emprestimo') {
          await registrarEvento(client, reservaId, 'retirada', req.usuario!.id, null);
          await client.query(`UPDATE veiculos SET situacao = 'em_uso', atualizado_por = $1 WHERE id = $2`,
            [req.usuario!.id, veiculo.id]);
        }
        return reservaId;
      });

      const { rows } = await query(`${SELECT_RESERVA} WHERE r.id = $1`, [id]);
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** POST /api/reservas/:id/retirada — registra a retirada do veículo de uma reserva agendada. */
router.post('/:id/retirada', authorize('reservas:gerenciar'), validate(idSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await transaction(async (client) => {
        const reserva = await buscarParaAtualizar(client, req.params.id);
        if (reserva.status !== 'agendada') {
          throw new AppError(422, 'Somente reservas agendadas podem ter a retirada registrada.');
        }
        const agora = new Date();
        if (reserva.fim_previsto <= agora) {
          throw new AppError(422, 'O período desta reserva já terminou. Cancele a reserva e registre uma nova.');
        }
        const veiculo = await validarVeiculo(client, reserva.veiculo_id, true);
        await validarCondutor(client, reserva.condutor_id, reserva.fim_previsto);
        // Retirada antes do horário previsto: o período antecipado também precisa estar livre
        if (agora < reserva.inicio) {
          await verificarConflito(client, veiculo.id, agora, reserva.fim_previsto, reserva.id);
        }

        await client.query(
          `UPDATE reservas SET status = 'em_uso', retirada_em = $1, atualizado_por = $2 WHERE id = $3`,
          [agora, req.usuario!.id, reserva.id]
        );
        await client.query(`UPDATE veiculos SET situacao = 'em_uso', atualizado_por = $1 WHERE id = $2`,
          [req.usuario!.id, veiculo.id]);
        await registrarEvento(client, reserva.id, 'retirada', req.usuario!.id, null);
      });
      const { rows } = await query(`${SELECT_RESERVA} WHERE r.id = $1`, [req.params.id]);
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** POST /api/reservas/:id/cancelamento — cancela uma reserva agendada, com motivo. */
router.post('/:id/cancelamento', authorize('reservas:gerenciar'), validate(idSchema, 'params'), validate(cancelarSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await transaction(async (client) => {
        const reserva = await buscarParaAtualizar(client, req.params.id);
        if (reserva.status === 'em_uso') {
          throw new AppError(422, 'O veículo já foi retirado. O encerramento deve ser feito pelo registro da devolução.');
        }
        if (reserva.status !== 'agendada') {
          throw new AppError(422, 'Somente reservas agendadas podem ser canceladas.');
        }
        await client.query(
          `UPDATE reservas SET status = 'cancelada', motivo_cancelamento = $1, atualizado_por = $2 WHERE id = $3`,
          [req.body.motivo, req.usuario!.id, reserva.id]
        );
        await registrarEvento(client, reserva.id, 'cancelamento', req.usuario!.id, req.body.motivo);
      });
      const { rows } = await query(`${SELECT_RESERVA} WHERE r.id = $1`, [req.params.id]);
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

// ------------------------------------------------------------------ regras de negócio

const SITUACAO_TEXTO: Record<string, string> = {
  manutencao: 'em manutenção',
  indisponivel: 'indisponível',
  em_uso: 'em uso',
};

/** Bloqueia o veículo até o fim da transação e verifica se ele pode ser reservado ou retirado. */
async function validarVeiculo(client: PoolClient, veiculoId: string, retiradaImediata: boolean) {
  const { rows } = await client.query<{ id: string; placa: string; modalidade: string; situacao: string; ativo: boolean }>(
    'SELECT id, placa, modalidade, situacao, ativo FROM veiculos WHERE id = $1 FOR UPDATE',
    [veiculoId]
  );
  const v = rows[0];
  if (!v || !v.ativo) throw new AppError(422, 'Veículo não encontrado.');
  if (v.modalidade !== 'pool') {
    throw new AppError(422, `O veículo ${v.placa} é de uso atribuído e não pode ser reservado nem emprestado.`);
  }
  if (v.situacao === 'manutencao' || v.situacao === 'indisponivel') {
    throw new AppError(422, `O veículo ${v.placa} está ${SITUACAO_TEXTO[v.situacao]} e não pode ser reservado nem emprestado.`);
  }
  if (retiradaImediata && v.situacao === 'em_uso') {
    throw new AppError(409, `O veículo ${v.placa} está em uso e ainda não foi devolvido.`);
  }
  return v;
}

async function validarCondutor(client: PoolClient, condutorId: string, fim: Date) {
  const { rows } = await client.query<{ nome: string; ativo: boolean; liberado_pool: boolean; cnh_validade: string }>(
    'SELECT nome, ativo, liberado_pool, cnh_validade FROM condutores WHERE id = $1',
    [condutorId]
  );
  const c = rows[0];
  if (!c) throw new AppError(422, 'Condutor não encontrado.');
  if (!c.ativo) throw new AppError(422, `O cadastro do condutor ${c.nome} está inativo.`);
  if (!c.liberado_pool) {
    throw new AppError(422, `O condutor ${c.nome} não está liberado pelo Departamento de Frotas para utilizar veículos POOL.`);
  }
  const hoje = dataLocalISO(new Date());
  if (c.cnh_validade < hoje) {
    throw new AppError(422, `A CNH do condutor ${c.nome} venceu em ${dataBR(c.cnh_validade)}.`);
  }
  if (c.cnh_validade < dataLocalISO(fim)) {
    throw new AppError(422, `A CNH do condutor ${c.nome} vence em ${dataBR(c.cnh_validade)}, antes do fim do período informado.`);
  }
}

/** Rejeita o período quando ele se sobrepõe a outra reserva ou empréstimo ativo do mesmo veículo. */
async function verificarConflito(client: PoolClient, veiculoId: string, inicio: Date, fim: Date, ignorarId?: string) {
  const { rows } = await client.query<{ numero: number; inicio: Date; fim_previsto: Date; status: string }>(
    `SELECT r.numero, r.inicio, r.fim_previsto, r.status
       FROM reservas r
      WHERE r.veiculo_id = $1 AND r.status IN ('agendada', 'em_uso')
        AND r.id <> COALESCE($4::uuid, gen_random_uuid())
        AND ${INICIO_OCUPADO} < $3 AND ${FIM_OCUPADO} > $2
      ORDER BY r.inicio LIMIT 1`,
    [veiculoId, inicio, fim, ignorarId ?? null]
  );
  const c = rows[0];
  if (c) {
    const tipo = c.status === 'em_uso' ? 'um empréstimo em andamento' : 'uma reserva';
    throw new AppError(409, `O veículo já possui ${tipo} no período informado `
      + `(nº ${String(c.numero).padStart(4, '0')}, de ${dataHora(c.inicio)} a ${dataHora(c.fim_previsto)}).`);
  }
}

async function buscarParaAtualizar(client: PoolClient, id: string) {
  // Mesma ordem de bloqueio do registro (primeiro o veículo, depois a reserva), evitando impasse entre transações
  const ref = await client.query<{ veiculo_id: string }>('SELECT veiculo_id FROM reservas WHERE id = $1', [id]);
  if (!ref.rows[0]) throw new AppError(404, 'Reserva não encontrada.');
  await client.query('SELECT 1 FROM veiculos WHERE id = $1 FOR UPDATE', [ref.rows[0].veiculo_id]);
  const { rows } = await client.query<{
    id: string; status: string; veiculo_id: string; condutor_id: string; inicio: Date; fim_previsto: Date;
  }>('SELECT id, status, veiculo_id, condutor_id, inicio, fim_previsto FROM reservas WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new AppError(404, 'Reserva não encontrada.');
  return rows[0];
}

async function registrarEvento(client: PoolClient, reservaId: string, evento: string, usuarioId: string, observacao: string | null) {
  await client.query(
    'INSERT INTO reserva_eventos (reserva_id, evento, usuario_id, observacao) VALUES ($1, $2, $3, $4)',
    [reservaId, evento, usuarioId, observacao]
  );
}

export default router;
