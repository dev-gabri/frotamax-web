import { NextFunction, Response, Router } from 'express';
import Joi from 'joi';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';
import { mensagens, validate } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';
import { consultarHistorico, paginacao } from './reservas';

const router = Router();

export const TIPOS = ['hatch', 'sedan', 'suv', 'picape', 'utilitario', 'caminhao', 'outro'] as const;
export const MODALIDADES = ['pool', 'atribuido'] as const;
export const SITUACOES = ['disponivel', 'em_uso', 'manutencao', 'indisponivel'] as const;

const ANO_MAXIMO = new Date().getFullYear() + 1;

/** Placa no padrão brasileiro antigo (ABC1234) ou Mercosul (ABC1D23). Hífen e espaços são removidos. */
const placa = Joi.string()
  .trim()
  .uppercase()
  .replace(/[\s-]/g, '')
  .pattern(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/)
  .label('Placa')
  .messages({ 'string.pattern.base': 'A placa deve seguir o padrão ABC1234 ou ABC1D23.' });

const camposVeiculo = {
  codigo: Joi.string().trim().uppercase().max(20).pattern(/^[A-Z0-9-]+$/).label('Código')
    .messages({ 'string.pattern.base': 'O código deve conter apenas letras, números e hífen.' }),
  placa,
  marca: Joi.string().trim().min(2).max(60).label('Marca'),
  modelo: Joi.string().trim().min(1).max(80).label('Modelo'),
  ano_modelo: Joi.number().integer().min(1980).max(ANO_MAXIMO).allow(null).label('Ano do modelo'),
  tipo: Joi.string().valid(...TIPOS).label('Tipo'),
  unidade: Joi.string().trim().min(2).max(80).label('Unidade'),
  quilometragem: Joi.number().integer().min(0).max(5_000_000).label('Quilometragem'),
  modalidade: Joi.string().valid(...MODALIDADES).label('Modalidade de uso'),
  situacao: Joi.string().valid(...SITUACOES).label('Situação'),
  observacoes: Joi.string().trim().max(500).allow('', null).label('Observações'),
};

const criarSchema = Joi.object({
  ...camposVeiculo,
  codigo: camposVeiculo.codigo.required(),
  placa: camposVeiculo.placa.required(),
  marca: camposVeiculo.marca.required(),
  modelo: camposVeiculo.modelo.required(),
  tipo: camposVeiculo.tipo.required(),
  unidade: camposVeiculo.unidade.required(),
  quilometragem: camposVeiculo.quilometragem.default(0),
  modalidade: camposVeiculo.modalidade.default('pool'),
  situacao: camposVeiculo.situacao.default('disponivel'),
}).messages(mensagens);

const atualizarSchema = Joi.object(camposVeiculo).min(1).messages(mensagens);

const situacaoSchema = Joi.object({
  situacao: camposVeiculo.situacao.required(),
}).messages(mensagens);

const idSchema = Joi.object({
  id: Joi.string().guid({ version: ['uuidv4'] }).required().label('Identificador'),
}).messages(mensagens);

const listarSchema = Joi.object({
  busca: Joi.string().trim().max(60).allow('').label('Busca'),
  situacao: Joi.string().valid(...SITUACOES).label('Situação'),
  tipo: Joi.string().valid(...TIPOS).label('Tipo'),
  modalidade: Joi.string().valid(...MODALIDADES).label('Modalidade de uso'),
}).messages(mensagens);

const historicoSchema = Joi.object(paginacao).messages(mensagens);

const COLUNAS = `id, codigo, placa, marca, modelo, ano_modelo, tipo, unidade, quilometragem,
  modalidade, situacao, observacoes, criado_em, atualizado_em`;

router.use(authenticate);

/** GET /api/veiculos — lista os veículos ativos com busca e filtros. */
router.get('/', authorize('veiculos:consultar'), validate(listarSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { busca, situacao, tipo, modalidade } = req.query as Record<string, string | undefined>;
      const filtros: string[] = ['ativo = TRUE'];
      const params: unknown[] = [];

      if (busca) {
        params.push(`%${busca.replace(/[%_\\]/g, '\\$&')}%`);
        filtros.push(`(placa ILIKE $${params.length} OR codigo ILIKE $${params.length} OR modelo ILIKE $${params.length} OR marca ILIKE $${params.length} OR unidade ILIKE $${params.length})`);
      }
      if (situacao) { params.push(situacao); filtros.push(`situacao = $${params.length}`); }
      if (tipo) { params.push(tipo); filtros.push(`tipo = $${params.length}`); }
      if (modalidade) { params.push(modalidade); filtros.push(`modalidade = $${params.length}`); }

      const { rows } = await query(
        `SELECT ${COLUNAS} FROM veiculos WHERE ${filtros.join(' AND ')} ORDER BY codigo`,
        params
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/veiculos/resumo — totais por situação para os indicadores da tela. */
router.get('/resumo', authorize('veiculos:consultar'),
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query<{ situacao: string; total: string }>(
        'SELECT situacao, COUNT(*) AS total FROM veiculos WHERE ativo = TRUE GROUP BY situacao'
      );
      const resumo = { total: 0, disponivel: 0, em_uso: 0, manutencao: 0, indisponivel: 0 } as Record<string, number>;
      for (const r of rows) {
        resumo[r.situacao] = Number(r.total);
        resumo.total += Number(r.total);
      }
      res.json({ success: true, data: resumo });
    } catch (error) {
      next(error);
    }
  });

/** GET /api/veiculos/:id — consulta um veículo. */
router.get('/:id', authorize('veiculos:consultar'), validate(idSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query(`SELECT ${COLUNAS} FROM veiculos WHERE id = $1 AND ativo = TRUE`, [req.params.id]);
      if (!rows[0]) throw new AppError(404, 'Veículo não encontrado.');
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/**
 * GET /api/veiculos/:id/historico — histórico de utilização do veículo (Sprint 03, RF12/CA08).
 * Também responde para veículos inativos, para que o histórico não se perca.
 */
router.get('/:id/historico', authorize('reservas:consultar'), validate(idSchema, 'params'), validate(historicoSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = await query(
        'SELECT id, codigo, placa, marca, modelo, quilometragem, modalidade, situacao, ativo FROM veiculos WHERE id = $1',
        [req.params.id]
      );
      if (!rows[0]) throw new AppError(404, 'Veículo não encontrado.');
      const { pagina, por_pagina } = req.query as unknown as { pagina: number; por_pagina: number };
      const { resumo, itens, meta } = await consultarHistorico('veiculo', req.params.id, pagina, por_pagina);
      res.json({ success: true, data: { veiculo: rows[0], resumo, itens }, meta });
    } catch (error) {
      next(error);
    }
  });

/** POST /api/veiculos — cadastra um veículo. */
router.post('/', authorize('veiculos:gerenciar'), validate(criarSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const v = req.body;
      await garantirUnicidade(v.placa, v.codigo);
      const { rows } = await query(
        `INSERT INTO veiculos (codigo, placa, marca, modelo, ano_modelo, tipo, unidade, quilometragem,
                               modalidade, situacao, observacoes, criado_por, atualizado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
         RETURNING ${COLUNAS}`,
        [v.codigo, v.placa, v.marca, v.modelo, v.ano_modelo ?? null, v.tipo, v.unidade, v.quilometragem,
          v.modalidade, v.situacao, v.observacoes || null, req.usuario!.id]
      );
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** PUT /api/veiculos/:id — atualiza as informações de um veículo. */
router.put('/:id', authorize('veiculos:gerenciar'), validate(idSchema, 'params'), validate(atualizarSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const atual = await buscarAtivo(req.params.id);
      const dados = req.body as Record<string, unknown>;

      if (dados.quilometragem !== undefined && Number(dados.quilometragem) < atual.quilometragem) {
        throw new AppError(422, `A quilometragem informada é menor que a registrada (${atual.quilometragem} km).`);
      }
      if (dados.situacao !== undefined && dados.situacao !== atual.situacao) {
        await validarMudancaSituacao(atual, dados.situacao as string, (dados.modalidade as string) ?? atual.modalidade);
      }
      if (dados.modalidade === 'atribuido' && atual.modalidade === 'pool') {
        const ativas = await reservasAtivas(atual.id);
        if (ativas) {
          throw new AppError(409, `O veículo possui ${ativas} reserva(s) ou empréstimo(s) em aberto e não pode passar para uso atribuído.`);
        }
      }
      await garantirUnicidade(dados.placa as string | undefined, dados.codigo as string | undefined, atual.id);

      const campos = Object.keys(dados);
      const sets = campos.map((c, i) => `${c} = $${i + 1}`);
      const valores = campos.map((c) => (c === 'observacoes' ? dados[c] || null : dados[c]));
      valores.push(req.usuario!.id, atual.id);

      const { rows } = await query(
        `UPDATE veiculos SET ${sets.join(', ')}, atualizado_por = $${valores.length - 1}
         WHERE id = $${valores.length} RETURNING ${COLUNAS}`,
        valores
      );
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

/** PATCH /api/veiculos/:id/situacao — altera somente a situação operacional. */
router.patch('/:id/situacao', authorize('veiculos:gerenciar'), validate(idSchema, 'params'), validate(situacaoSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const atual = await buscarAtivo(req.params.id);
      if (req.body.situacao !== atual.situacao) {
        await validarMudancaSituacao(atual, req.body.situacao, atual.modalidade);
      }
      const { rows } = await query(
        `UPDATE veiculos SET situacao = $1, atualizado_por = $2 WHERE id = $3 RETURNING ${COLUNAS}`,
        [req.body.situacao, req.usuario!.id, atual.id]
      );
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  });

interface VeiculoAtual { id: string; quilometragem: number; situacao: string; modalidade: string }

async function buscarAtivo(id: string) {
  const { rows } = await query<VeiculoAtual>(
    'SELECT id, quilometragem, situacao, modalidade FROM veiculos WHERE id = $1 AND ativo = TRUE',
    [id]
  );
  if (!rows[0]) throw new AppError(404, 'Veículo não encontrado.');
  return rows[0];
}

async function reservasAtivas(veiculoId: string): Promise<number> {
  const { rows } = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM reservas WHERE veiculo_id = $1 AND status IN ('agendada', 'em_uso')`,
    [veiculoId]
  );
  return Number(rows[0].total);
}

/**
 * Mantém a situação coerente com os empréstimos (Sprint 02):
 *  - um veículo POOL só fica "em uso" por meio do registro de um empréstimo ou retirada;
 *  - enquanto houver empréstimo em andamento, a situação só muda com o registro da devolução.
 */
async function validarMudancaSituacao(atual: VeiculoAtual, nova: string, modalidade: string) {
  const { rows } = await query<{ numero: number }>(
    `SELECT numero FROM reservas WHERE veiculo_id = $1 AND status = 'em_uso' LIMIT 1`,
    [atual.id]
  );
  if (rows[0]) {
    throw new AppError(409, `O veículo está emprestado (nº ${String(rows[0].numero).padStart(4, '0')}). `
      + 'A situação será atualizada no registro da devolução.');
  }
  if (nova === 'em_uso' && modalidade === 'pool') {
    throw new AppError(422, 'Para colocar um veículo POOL em uso, registre um empréstimo ou a retirada de uma reserva.');
  }
}

/** Retorna mensagens claras quando placa ou código já pertencem a outro veículo. */
async function garantirUnicidade(placaInformada?: string, codigo?: string, ignorarId?: string) {
  if (placaInformada) {
    const { rowCount } = await query('SELECT 1 FROM veiculos WHERE placa = $1 AND id <> COALESCE($2::uuid, gen_random_uuid())', [placaInformada, ignorarId ?? null]);
    if (rowCount) throw new AppError(409, 'Já existe um veículo cadastrado com esta placa.');
  }
  if (codigo) {
    const { rowCount } = await query('SELECT 1 FROM veiculos WHERE UPPER(codigo) = $1 AND id <> COALESCE($2::uuid, gen_random_uuid())', [codigo, ignorarId ?? null]);
    if (rowCount) throw new AppError(409, 'Já existe um veículo cadastrado com este código.');
  }
}

export default router;
