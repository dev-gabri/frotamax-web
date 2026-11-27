import { NextFunction, Response, Router } from 'express';
import Joi from 'joi';
import { PoolClient } from 'pg';
import { query, transaction } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';
import { dataIso, dataSimples, mensagens, validate } from '../middleware/validate';
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
 *
 * Devolução (Sprint 03), regras combinadas com o Departamento de Frotas:
 *  - registra data e hora, quilometragem de chegada e observação;
 *  - a quilometragem de chegada atualiza a do veículo e não pode ser menor que a registrada;
 *  - o Departamento de Frotas pode enviar o veículo para manutenção no próprio registro da devolução.
 * Decisões técnicas da equipe: a data e a hora informadas não podem ser futuras nem anteriores à
 * retirada, e o envio para manutenção exige a descrição do problema
 * (ver docs/sprint-03/REGRAS_DEVOLUCAO.md).
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
  inicio: dataIso().label('Início').when('tipo', { is: 'reserva', then: Joi.required(), otherwise: Joi.forbidden() }),
  fim_previsto: dataIso().required().label('Previsão de devolução'),
  finalidade: Joi.string().trim().min(3).max(200).required().label('Finalidade'),
  observacoes: Joi.string().trim().max(500).allow('', null).label('Observações'),
}).messages({ ...mensagens, 'any.unknown': 'O campo {#label} não deve ser informado para empréstimos (a retirada é imediata).' });

const cancelarSchema = Joi.object({
  motivo: Joi.string().trim().min(5).max(300).required().label('Motivo do cancelamento'),
}).messages(mensagens);

const idSchema = Joi.object({ id: uuid.required().label('Identificador') }).messages(mensagens);

/** Paginação das consultas, para não carregar todo o histórico de uma vez (RNF10). */
export const paginacao = {
  pagina: Joi.number().integer().min(1).max(10_000).default(1).label('Página'),
  por_pagina: Joi.number().integer().min(1).max(100).default(50).label('Itens por página'),
};

const listarSchema = Joi.object({
  busca: Joi.string().trim().max(60).allow('').label('Busca'),
  status: Joi.string().valid(...STATUS_RESERVA).label('Status'),
  tipo: Joi.string().valid(...TIPOS_RESERVA).label('Tipo'),
  veiculo_id: uuid.label('Veículo'),
  condutor_id: uuid.label('Condutor'),
  de: dataSimples().label('Data inicial'),
  ate: dataSimples().label('Data final'),
  ...paginacao,
}).messages(mensagens);

const devolucaoSchema = Joi.object({
  devolvida_em: dataIso().label('Data e hora da devolução'),
  km_devolucao: Joi.number().integer().min(0).max(5_000_000).required().label('Quilometragem de chegada'),
  observacao: Joi.string().trim().max(500).allow('', null).label('Observação'),
  enviar_manutencao: Joi.boolean().default(false).label('Enviar para manutenção'),
}).messages(mensagens);

const disponibilidadeSchema = Joi.object({
  tipo: Joi.string().valid(...TIPOS_RESERVA).default('reserva').label('Tipo'),
  inicio: dataIso().label('Início').when('tipo', { is: 'reserva', then: Joi.required() }),
  fim: dataIso().required().label('Previsão de devolução'),
}).messages(mensagens);

/**
 * Período efetivamente ocupado por uma reserva ativa:
 *  - começa na retirada, se ela ocorreu antes do início previsto;
 *  - um empréstimo em uso e atrasado continua ocupando o veículo até a devolução.
 */
const INICIO_OCUPADO = 'LEAST(r.inicio, COALESCE(r.retirada_em, r.inicio))';
const FIM_OCUPADO = `CASE WHEN r.status = 'em_uso' THEN GREATEST(r.fim_previsto, NOW()) ELSE r.fim_previsto END`;

export const SELECT_RESERVA = `
  SELECT r.id, r.numero, r.tipo, r.status, r.inicio, r.fim_previsto, r.retirada_em, r.devolvida_em,
         r.finalidade, r.observacoes, r.motivo_cancelamento, r.criado_em, r.atualizado_em,
         r.km_retirada, r.km_devolucao, (r.km_devolucao - r.km_retirada) AS km_percorridos,
         r.observacao_devolucao, r.enviado_manutencao,
         (r.status = 'em_uso' AND r.fim_previsto < NOW()) AS atrasada,
         (r.status = 'concluida' AND r.devolvida_em > r.fim_previsto) AS devolvida_com_atraso,
         json_build_object('id', v.id, 'codigo', v.codigo, 'placa', v.placa, 'marca', v.marca, 'modelo', v.modelo,
                           'quilometragem', v.quilometragem, 'situacao', v.situacao) AS veiculo,
         json_build_object('id', c.id, 'nome', c.nome, 'matricula', c.matricula) AS condutor
    FROM reservas r
    JOIN veiculos v ON v.id = r.veiculo_id
    JOIN condutores c ON c.id = r.condutor_id`;

/** Em andamento e agendadas primeiro (da mais próxima para a mais distante); encerradas da mais recente para a mais antiga. */
export const ORDEM = `array_position(ARRAY['em_uso', 'agendada', 'concluida', 'cancelada']::varchar[], r.status),
  CASE WHEN r.status IN ('em_uso', 'agendada') THEN r.inicio END ASC, r.inicio DESC, r.numero DESC`;

/** Início do dia (00h no fuso da aplicação) de uma data AAAA-MM-DD. */
const inicioDoDia = (param: string) => `(${param}::date::timestamp AT TIME ZONE '${FUSO_APLICACAO}')`;

router.use(authenticate);

/** GET /api/reservas — lista reservas e empréstimos com busca e filtros. */
router.get('/', authorize('reservas:consultar'), validate(listarSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { busca, status, tipo, veiculo_id, condutor_id, de, ate } = req.query as Record<string, string | undefined>;
      const { pagina, por_pagina } = req.query as unknown as { pagina: number; por_pagina: number };
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
      if (de && ate && de > ate) throw new AppError(422, 'A data inicial deve ser anterior ou igual à data final.');
      // Período: movimentações que ocorreram (total ou parcialmente) entre as datas informadas
      if (de) {
        params.push(de);
        filtros.push(`COALESCE(r.devolvida_em, GREATEST(r.fim_previsto, CASE WHEN r.status = 'em_uso' THEN NOW() END)) >= ${inicioDoDia(`$${params.length}`)}`);
      }
      if (ate) {
        params.push(ate);
        filtros.push(`LEAST(r.inicio, COALESCE(r.retirada_em, r.inicio)) < ${inicioDoDia(`$${params.length}`)} + INTERVAL '1 day'`);
      }

      const resultado = await listarPaginado(filtros, params, pagina, por_pagina);
      res.json({ success: true, ...resultado });
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
          `INSERT INTO reservas (tipo, veiculo_id, condutor_id, inicio, fim_previsto, retirada_em, km_retirada,
                                 finalidade, observacoes, status, criado_por, atualizado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) RETURNING id`,
          [d.tipo, veiculo.id, d.condutor_id, inicio, d.fim_previsto, d.tipo === 'emprestimo' ? agora : null,
            d.tipo === 'emprestimo' ? veiculo.quilometragem : null, d.finalidade, d.observacoes || null, status, req.usuario!.id]
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
          `UPDATE reservas SET status = 'em_uso', retirada_em = $1, km_retirada = $2, atualizado_por = $3 WHERE id = $4`,
          [agora, veiculo.quilometragem, req.usuario!.id, reserva.id]
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

/**
 * POST /api/reservas/:id/devolucao — registra a devolução de um veículo retirado (Sprint 03).
 * Encerra a movimentação, atualiza a quilometragem do veículo e o deixa disponível,
 * ou em manutenção quando o Departamento de Frotas assim indicar.
 */
router.post('/:id/devolucao', authorize('reservas:gerenciar'), validate(idSchema, 'params'), validate(devolucaoSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const d = req.body as { devolvida_em?: Date; km_devolucao: number; observacao?: string | null; enviar_manutencao: boolean };
      const observacao = d.observacao?.trim() || null;
      if (d.enviar_manutencao && (!observacao || observacao.length < 5)) {
        throw new AppError(422, 'Descreva o problema encontrado (pelo menos 5 caracteres) para enviar o veículo para manutenção.');
      }
      const agora = new Date();
      let devolvidaEm = d.devolvida_em ?? agora;
      if (devolvidaEm.getTime() > agora.getTime() + TOLERANCIA_MS) {
        throw new AppError(422, 'A data e a hora da devolução não podem estar no futuro.');
      }

      const afetadas = await transaction(async (client) => {
        const reserva = await buscarParaAtualizar(client, req.params.id);
        if (reserva.status === 'concluida') {
          throw new AppError(409, 'A devolução desta movimentação já foi registrada.');
        }
        if (reserva.status === 'agendada') {
          throw new AppError(422, 'O veículo desta reserva ainda não foi retirado. Registre a retirada ou cancele a reserva.');
        }
        if (reserva.status !== 'em_uso') {
          throw new AppError(422, 'Somente movimentações em andamento podem ter a devolução registrada.');
        }
        // O formulário informa a hora em minutos: no mesmo minuto da retirada, vale o horário da retirada (BUG-06)
        const minuto = (d: Date) => Math.floor(d.getTime() / 60_000);
        if (devolvidaEm < reserva.retirada_em! && minuto(devolvidaEm) === minuto(reserva.retirada_em!)) {
          devolvidaEm = reserva.retirada_em!;
        }
        if (devolvidaEm < reserva.retirada_em!) {
          throw new AppError(422, `A devolução não pode ser anterior à retirada (${dataHora(reserva.retirada_em!)}).`);
        }

        const { rows: vs } = await client.query<{ placa: string; quilometragem: number }>(
          'SELECT placa, quilometragem FROM veiculos WHERE id = $1', [reserva.veiculo_id]
        );
        const veiculo = vs[0];
        if (d.km_devolucao < veiculo.quilometragem) {
          throw new AppError(422, `A quilometragem de chegada (${km(d.km_devolucao)}) é menor que a registrada `
            + `para o veículo ${veiculo.placa} (${km(veiculo.quilometragem)}).`);
        }

        await client.query(
          `UPDATE reservas
              SET status = 'concluida', devolvida_em = $1, km_devolucao = $2, observacao_devolucao = $3,
                  enviado_manutencao = $4, devolvida_por = $5, atualizado_por = $5,
                  km_retirada = COALESCE(km_retirada, $6)
            WHERE id = $7`,
          [devolvidaEm, d.km_devolucao, observacao, d.enviar_manutencao, req.usuario!.id, veiculo.quilometragem, reserva.id]
        );
        await client.query(
          'UPDATE veiculos SET quilometragem = $1, situacao = $2, atualizado_por = $3 WHERE id = $4',
          [d.km_devolucao, d.enviar_manutencao ? 'manutencao' : 'disponivel', req.usuario!.id, reserva.veiculo_id]
        );
        const resumo = `Devolução com ${km(d.km_devolucao)}.`
          + (d.enviar_manutencao ? ' Veículo enviado para manutenção.' : '')
          + (observacao ? ` ${observacao}` : '');
        await registrarEvento(client, reserva.id, 'devolucao', req.usuario!.id, resumo.slice(0, 300));

        if (!d.enviar_manutencao) return [];
        // Reservas futuras do veículo enviado para manutenção: não são canceladas automaticamente,
        // mas são informadas para que o Departamento de Frotas decida o que fazer
        const { rows } = await client.query<{ numero: number; inicio: Date; fim_previsto: Date; condutor: string }>(
          `SELECT r.numero, r.inicio, r.fim_previsto, c.nome AS condutor
             FROM reservas r JOIN condutores c ON c.id = r.condutor_id
            WHERE r.veiculo_id = $1 AND r.status = 'agendada' ORDER BY r.inicio`,
          [reserva.veiculo_id]
        );
        return rows;
      });

      const { rows } = await query(`${SELECT_RESERVA} WHERE r.id = $1`, [req.params.id]);
      res.json({ success: true, data: { ...rows[0], reservas_afetadas: afetadas } });
    } catch (error) {
      next(error);
    }
  });

// ------------------------------------------------------------------ consultas paginadas e histórico

/** Lista movimentações com filtros já montados, devolvendo a página pedida e o total encontrado. */
export async function listarPaginado(filtros: string[], params: unknown[], pagina: number, porPagina: number) {
  const where = filtros.join(' AND ');
  const total = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM reservas r JOIN veiculos v ON v.id = r.veiculo_id
       JOIN condutores c ON c.id = r.condutor_id WHERE ${where}`,
    params
  );
  const p = [...params, porPagina, (pagina - 1) * porPagina];
  const { rows } = await query(
    `${SELECT_RESERVA} WHERE ${where} ORDER BY ${ORDEM} LIMIT $${p.length - 1} OFFSET $${p.length}`,
    p
  );
  return { data: rows, meta: { pagina, por_pagina: porPagina, total: Number(total.rows[0].total) } };
}

/**
 * Histórico de utilização de um veículo ou de um condutor (RF12, CA08): resumo e movimentações,
 * incluindo as já encerradas, das mais recentes para as mais antigas.
 */
export async function consultarHistorico(alvo: 'veiculo' | 'condutor', id: string, pagina: number, porPagina: number) {
  const coluna = alvo === 'veiculo' ? 'r.veiculo_id' : 'r.condutor_id';
  const { rows: resumo } = await query<Record<string, string | null>>(
    `SELECT COUNT(*) AS movimentacoes,
            COUNT(*) FILTER (WHERE r.status = 'concluida') AS concluidas,
            COUNT(*) FILTER (WHERE r.status = 'cancelada') AS canceladas,
            COUNT(*) FILTER (WHERE r.status IN ('agendada', 'em_uso')) AS em_aberto,
            COUNT(*) FILTER (WHERE r.status = 'concluida' AND r.devolvida_em > r.fim_previsto) AS devolvidas_com_atraso,
            COALESCE(SUM(r.km_devolucao - r.km_retirada) FILTER (WHERE r.status = 'concluida'), 0) AS km_percorridos,
            MAX(r.devolvida_em) AS ultima_devolucao
       FROM reservas r WHERE ${coluna} = $1`,
    [id]
  );
  const r = resumo[0];
  const pagina_ = await listarPaginado([`${coluna} = $1`], [id], pagina, porPagina);
  return {
    resumo: {
      movimentacoes: Number(r.movimentacoes),
      concluidas: Number(r.concluidas),
      canceladas: Number(r.canceladas),
      em_aberto: Number(r.em_aberto),
      devolvidas_com_atraso: Number(r.devolvidas_com_atraso),
      km_percorridos: Number(r.km_percorridos),
      ultima_devolucao: r.ultima_devolucao,
    },
    itens: pagina_.data,
    meta: pagina_.meta,
  };
}

// ------------------------------------------------------------------ regras de negócio

const formatoKm = new Intl.NumberFormat('pt-BR');
const km = (valor: number) => `${formatoKm.format(valor)} km`;

const SITUACAO_TEXTO: Record<string, string> = {
  manutencao: 'em manutenção',
  indisponivel: 'indisponível',
  em_uso: 'em uso',
};

/** Bloqueia o veículo até o fim da transação e verifica se ele pode ser reservado ou retirado. */
async function validarVeiculo(client: PoolClient, veiculoId: string, retiradaImediata: boolean) {
  const { rows } = await client.query<{
    id: string; placa: string; modalidade: string; situacao: string; ativo: boolean; quilometragem: number;
  }>(
    'SELECT id, placa, modalidade, situacao, ativo, quilometragem FROM veiculos WHERE id = $1 FOR UPDATE',
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
    // FOR SHARE: aguarda uma inativação em andamento do mesmo condutor (Sprint 04)
    'SELECT nome, ativo, liberado_pool, cnh_validade FROM condutores WHERE id = $1 FOR SHARE',
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
    retirada_em: Date | null;
  }>('SELECT id, status, veiculo_id, condutor_id, inicio, fim_previsto, retirada_em FROM reservas WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new AppError(404, 'Reserva não encontrada.');
  return rows[0];
}

/**
 * Registra um evento da movimentação. O horário vem de clock_timestamp() (e não de NOW(), que é fixo
 * durante a transação), para que eventos gravados juntos, como o registro e a retirada de um
 * empréstimo, apareçam no histórico na ordem em que aconteceram (BUG-05).
 */
async function registrarEvento(client: PoolClient, reservaId: string, evento: string, usuarioId: string, observacao: string | null) {
  await client.query(
    'INSERT INTO reserva_eventos (reserva_id, evento, usuario_id, observacao, criado_em) VALUES ($1, $2, $3, $4, clock_timestamp())',
    [reservaId, evento, usuarioId, observacao]
  );
}

export default router;
