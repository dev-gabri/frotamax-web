import { NextFunction, Response, Router } from 'express';
import Joi from 'joi';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';
import { mensagens, validate } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';
import { FUSO_APLICACAO } from '../utils/datas';

const router = Router();

export const CATEGORIAS_CNH = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] as const;
export const SITUACOES_CNH = ['valida', 'vencendo', 'vencida'] as const;

/** Dias de antecedência para sinalizar que a CNH está perto de vencer. */
export const DIAS_AVISO_CNH = 30;

const camposCondutor = {
  nome: Joi.string().trim().min(3).max(120).label('Nome'),
  matricula: Joi.string().trim().uppercase().max(20).pattern(/^[A-Z0-9.-]+$/).label('Matrícula')
    .messages({ 'string.pattern.base': 'A matrícula deve conter apenas letras, números, ponto e hífen.' }),
  cnh_categoria: Joi.string().trim().uppercase().valid(...CATEGORIAS_CNH).label('Categoria da CNH'),
  cnh_validade: Joi.date().iso().label('Validade da CNH'),
  telefone: Joi.string().trim().max(20).pattern(/^[0-9()+\s-]{8,20}$/).allow('', null).label('Telefone')
    .messages({ 'string.pattern.base': 'O telefone deve conter apenas números, espaços, parênteses, + e hífen.' }),
  liberado_pool: Joi.boolean().label('Liberado para o POOL'),
  ativo: Joi.boolean().label('Ativo'),
  observacoes: Joi.string().trim().max(500).allow('', null).label('Observações'),
};

const criarSchema = Joi.object({
  ...camposCondutor,
  nome: camposCondutor.nome.required(),
  matricula: camposCondutor.matricula.required(),
  cnh_categoria: camposCondutor.cnh_categoria.required(),
  cnh_validade: camposCondutor.cnh_validade.required(),
  liberado_pool: camposCondutor.liberado_pool.default(false),
  ativo: Joi.forbidden(),
}).messages(mensagens);

const atualizarSchema = Joi.object(camposCondutor).min(1).messages(mensagens);

const idSchema = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).required().label('Identificador'),
}).messages(mensagens);

const listarSchema = Joi.object({
  busca: Joi.string().trim().max(60).allow('').label('Busca'),
  situacao_cnh: Joi.string().valid(...SITUACOES_CNH).label('Situação da CNH'),
  liberado_pool: Joi.boolean().label('Liberado para o POOL'),
  ativo: Joi.boolean().default(true).label('Ativo'),
}).messages(mensagens);

/** Situação da CNH calculada pelo banco a partir da validade e da data atual. */
const HOJE_SQL = `(NOW() AT TIME ZONE '${FUSO_APLICACAO}')::date`;
const SITUACAO_CNH_SQL = `CASE
    WHEN cnh_validade < ${HOJE_SQL} THEN 'vencida'
    WHEN cnh_validade <= ${HOJE_SQL} + ${DIAS_AVISO_CNH} THEN 'vencendo'
    ELSE 'valida' END`;

const COLUNAS = `id, nome, matricula, cnh_categoria, cnh_validade, ${SITUACAO_CNH_SQL} AS situacao_cnh,
  telefone, liberado_pool, ativo, observacoes, criado_em, atualizado_em`;

router.use(authenticate);

/** GET /api/condutores — lista os condutores com busca e filtros. */
router.get('/', authorize('condutores:consultar'), validate(listarSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { busca, situacao_cnh, liberado_pool, ativo } = req.query as unknown as {
        busca?: string; situacao_cnh?: string; liberado_pool?: boolean; ativo: boolean;
      };
      const params: unknown[] = [ativo];
      const filtros: string[] = ['ativo = $1'];

      if (busca) {
        params.push(`%${busca.replace(/[%_\\]/g, '\\$&')}%`);
        filtros.push(`(nome ILIKE $${params.length} OR matricula ILIKE $${params.length})`);
      }
      if (liberado_pool !== undefined) { params.push(liberado_pool); filtros.push(`liberado_pool = $${params.length}`); }
      if (situacao_cnh) { params.push(situacao_cnh); filtros.push(`(${SITUACAO_CNH_SQL}) = $${params.length}`); }

      const { rows } = await query(
        `SELECT ${COLUNAS} FROM condutores WHERE ${filtros.join(' AND ')} ORDER BY nome`,
        params
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/condutores/resumo — totais para os indicadores da tela. */
router.get('/resumo', authorize('condutores:consultar'),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query<Record<string, string>>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE liberado_pool) AS liberados_pool,
                COUNT(*) FILTER (WHERE (${SITUACAO_CNH_SQL}) = 'vencendo') AS cnh_vencendo,
                COUNT(*) FILTER (WHERE (${SITUACAO_CNH_SQL}) = 'vencida') AS cnh_vencida
           FROM condutores WHERE ativo = TRUE`
      );
      const r = rows[0];
      res.json({
        success: true,
        data: {
          total: Number(r.total),
          liberados_pool: Number(r.liberados_pool),
          cnh_vencendo: Number(r.cnh_vencendo),
          cnh_vencida: Number(r.cnh_vencida),
        },
      });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/condutores/:id — consulta um condutor. */
router.get('/:id', authorize('condutores:consultar'), validate(idSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query(`SELECT ${COLUNAS} FROM condutores WHERE id = $1`, [req.params.id]);
      if (!rows[0]) throw new AppError(404, 'Condutor não encontrado.');
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** POST /api/condutores — cadastra um condutor. */
router.post('/', authorize('condutores:gerenciar'), validate(criarSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const c = req.body;
      await garantirMatriculaUnica(c.matricula);
      const { rows } = await query(
        `INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, telefone, liberado_pool,
                                 observacoes, criado_por, atualizado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING ${COLUNAS}`,
        [c.nome, c.matricula, c.cnh_categoria, dataISO(c.cnh_validade), c.telefone || null, c.liberado_pool,
          c.observacoes || null, req.usuario!.id]
      );
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** PUT /api/condutores/:id — atualiza um condutor (inclui liberação para o POOL e inativação). */
router.put('/:id', authorize('condutores:gerenciar'), validate(idSchema, 'params'), validate(atualizarSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows: atuais } = await query<{ id: string }>('SELECT id FROM condutores WHERE id = $1', [req.params.id]);
      if (!atuais[0]) throw new AppError(404, 'Condutor não encontrado.');
      const dados = { ...req.body } as Record<string, unknown>;

      if (dados.matricula) await garantirMatriculaUnica(dados.matricula as string, req.params.id);
      if (dados.cnh_validade) dados.cnh_validade = dataISO(dados.cnh_validade as Date);

      // Integridade: não retirar a liberação nem inativar quem tem reserva ou empréstimo em andamento
      if (dados.liberado_pool === false || dados.ativo === false) {
        const ativas = await reservasAtivas(req.params.id);
        if (ativas) {
          throw new AppError(409, `O condutor possui ${ativas} reserva(s) ou empréstimo(s) em aberto. `
            + 'Cancele as reservas ou registre a devolução antes de alterar a liberação ou inativar o cadastro.');
        }
      }

      const campos = Object.keys(dados);
      const sets = campos.map((c, i) => `${c} = $${i + 1}`);
      const valores = campos.map((c) => (['telefone', 'observacoes'].includes(c) ? dados[c] || null : dados[c]));
      valores.push(req.usuario!.id, req.params.id);

      const { rows } = await query(
        `UPDATE condutores SET ${sets.join(', ')}, atualizado_por = $${valores.length - 1}
         WHERE id = $${valores.length} RETURNING ${COLUNAS}`,
        valores
      );
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** Converte a data validada pelo Joi para AAAA-MM-DD, sem depender do fuso do servidor. */
function dataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

async function reservasAtivas(condutorId: string): Promise<number> {
  const { rows } = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM reservas WHERE condutor_id = $1 AND status IN ('agendada', 'em_uso')`,
    [condutorId]
  );
  return Number(rows[0].total);
}

async function garantirMatriculaUnica(matricula: string, ignorarId?: string) {
  const { rowCount } = await query(
    'SELECT 1 FROM condutores WHERE UPPER(matricula) = $1 AND id <> COALESCE($2::uuid, gen_random_uuid())',
    [matricula, ignorarId ?? null]
  );
  if (rowCount) throw new AppError(409, 'Já existe um condutor cadastrado com esta matrícula.');
}

export default router;
