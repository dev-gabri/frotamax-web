import request from 'supertest';
import { pool } from '../src/db/pool';
import { app, encerrar, prepararBanco, token } from './helpers';

let gestor: string;
let consulta: string;
const ids: Record<string, string> = {};

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const HORA = 3_600_000;
const emHoras = (h: number) => new Date(Date.now() + h * HORA).toISOString();
const dia = (deslocamento: number) => {
  const d = new Date(Date.now() + deslocamento * 24 * HORA);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

beforeAll(async () => {
  await prepararBanco();
  gestor = await token('gestor');
  consulta = await token('consulta');
  await pool.query(
    `INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, quilometragem, modalidade, situacao) VALUES
      ('I-001', 'KKK1K11', 'Fiat', 'Mobi', 'hatch', 'Unidade A', 80000, 'pool', 'disponivel'),
      ('I-002', 'LLL2L22', 'Fiat', 'Argo', 'hatch', 'Unidade A', 40000, 'pool', 'disponivel'),
      ('I-003', 'MMM3M33', 'VW', 'Saveiro', 'picape', 'Unidade B', 60000, 'pool', 'disponivel')`
  );
  const { rows: v } = await pool.query<{ id: string; codigo: string }>('SELECT id, codigo FROM veiculos');
  for (const r of v) ids[r.codigo] = r.id;
  await pool.query(
    `INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, liberado_pool) VALUES
      ('Condutora Inativação', 'I-1', 'B', $1, TRUE),
      ('Condutor Concorrência', 'I-2', 'B', $1, TRUE)`,
    [dia(365)]
  );
  const { rows: c } = await pool.query<{ id: string; matricula: string }>('SELECT id, matricula FROM condutores');
  for (const r of c) ids[r.matricula] = r.id;
});
afterAll(encerrar);

const inativar = (codigo: string, corpo: Record<string, unknown> = { motivo: 'Veículo vendido em leilão.' }) =>
  request(app).patch(`/api/veiculos/${ids[codigo]}/inativacao`).set(auth(gestor)).send(corpo);
const reativar = (codigo: string) => request(app).patch(`/api/veiculos/${ids[codigo]}/reativacao`).set(auth(gestor)).send({});
const emprestar = (codigo: string, condutor = 'I-1') => request(app).post('/api/reservas').set(auth(gestor)).send({
  tipo: 'emprestimo', veiculo_id: ids[codigo], condutor_id: ids[condutor], fim_previsto: emHoras(3), finalidade: 'Entrega de documentos',
});

describe('Inativação e integridade do histórico (Sprint 04)', () => {
  test('CT64 — veículo inativado sai da operação, mas o histórico continua consultável', async () => {
    // Uma utilização concluída antes da inativação
    const emp = await emprestar('I-001');
    await request(app).post(`/api/reservas/${emp.body.data.id}/devolucao`).set(auth(gestor)).send({ km_devolucao: 80120 });

    const res = await inativar('I-001');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ativo: false, motivo_inativacao: 'Veículo vendido em leilão.', inativado_por_nome: 'Gestor Teste' });
    expect(res.body.data.inativado_em).not.toBeNull();

    const ativos = await request(app).get('/api/veiculos').set(auth(consulta));
    expect(ativos.body.data.map((v: { codigo: string }) => v.codigo)).not.toContain('I-001');
    const resumo = await request(app).get('/api/veiculos/resumo').set(auth(consulta));
    expect(resumo.body.data.total).toBe(4); // T-001, T-002, I-002 e I-003
    const disp = await request(app).get('/api/reservas/disponibilidade').query({ tipo: 'emprestimo', fim: emHoras(2) }).set(auth(gestor));
    expect(disp.body.data.map((v: { codigo: string }) => v.codigo)).not.toContain('I-001');
    expect((await emprestar('I-001')).status).toBe(422);

    const inativos = await request(app).get('/api/veiculos').query({ ativo: false }).set(auth(consulta));
    expect(inativos.body.data).toEqual([expect.objectContaining({ codigo: 'I-001', ativo: false })]);
    const historico = await request(app).get(`/api/veiculos/${ids['I-001']}/historico`).set(auth(consulta));
    expect(historico.status).toBe(200);
    expect(historico.body.data.resumo).toMatchObject({ movimentacoes: 1, concluidas: 1, km_percorridos: 120 });
  });

  test('CT65 — inativação recusada com movimentação em aberto, sem motivo, repetida ou de veículo inexistente', async () => {
    const emp = await emprestar('I-002');
    expect(emp.status).toBe(201);
    const aberta = await inativar('I-002');
    expect(aberta.status).toBe(409);
    expect(aberta.body.error).toContain('possui 1 reserva(s) ou empréstimo(s) em aberto');
    expect((await pool.query("SELECT ativo FROM veiculos WHERE codigo = 'I-002'")).rows[0].ativo).toBe(true);
    await request(app).post(`/api/reservas/${emp.body.data.id}/devolucao`).set(auth(gestor)).send({ km_devolucao: 40010 });

    const semMotivo = await inativar('I-002', {});
    expect(semMotivo.status).toBe(400);
    expect(semMotivo.body.details).toEqual(['O campo Motivo da inativação é obrigatório.']);
    expect((await inativar('I-001')).status).toBe(409); // já inativo
    const inexistente = await request(app).patch('/api/veiculos/00000000-0000-4000-8000-000000000000/inativacao')
      .set(auth(gestor)).send({ motivo: 'Teste de inexistente.' });
    expect(inexistente.status).toBe(404);
  });

  test('CT66 — reativação devolve o veículo à operação e limpa os dados da inativação', async () => {
    const res = await reativar('I-001');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ativo: true, inativado_em: null, motivo_inativacao: null, inativado_por_nome: null });
    const ativos = await request(app).get('/api/veiculos').set(auth(consulta));
    expect(ativos.body.data.map((v: { codigo: string }) => v.codigo)).toContain('I-001');
    expect((await reativar('I-001')).status).toBe(409); // já ativo
  });

  test('CT67 — placa ou código de veículo inativo: o cadastro orienta a reativar em vez de duplicar', async () => {
    expect((await inativar('I-003')).status).toBe(200);
    const res = await request(app).post('/api/veiculos').set(auth(gestor)).send({
      codigo: 'I-099', placa: 'MMM-3M33', marca: 'VW', modelo: 'Saveiro', tipo: 'picape', unidade: 'Unidade B',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Já existe um veículo inativo com esta placa. Reative o cadastro em vez de cadastrar outro.');
    // Inativo também não pode ser editado nem ter a situação alterada
    expect((await request(app).put(`/api/veiculos/${ids['I-003']}`).set(auth(gestor)).send({ unidade: 'Unidade C' })).status).toBe(404);
  });

  test('CT68 — inativação de condutor registra data, responsável e motivo; a reativação limpa', async () => {
    const res = await request(app).put(`/api/condutores/${ids['I-1']}`).set(auth(gestor))
      .send({ ativo: false, motivo_inativacao: 'Desligado da empresa.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ativo: false, motivo_inativacao: 'Desligado da empresa.', inativado_por_nome: 'Gestor Teste' });
    expect(res.body.data.inativado_em).not.toBeNull();

    const motivoSemInativar = await request(app).put(`/api/condutores/${ids['I-2']}`).set(auth(gestor))
      .send({ nome: 'Condutor Concorrência', motivo_inativacao: 'Não deveria ser aceito.' });
    expect(motivoSemInativar.status).toBe(400);

    const reativado = await request(app).put(`/api/condutores/${ids['I-1']}`).set(auth(gestor)).send({ ativo: true });
    expect(reativado.body.data).toMatchObject({ ativo: true, inativado_em: null, motivo_inativacao: null });
    // O histórico do condutor continua com a utilização feita antes
    const hist = await request(app).get(`/api/condutores/${ids['I-1']}/historico`).set(auth(consulta));
    expect(hist.body.data.resumo.concluidas).toBe(2);
  });

  test('CT69 — o banco recusa a exclusão de cadastros e movimentações e a alteração dos eventos', async () => {
    const tentativas = [
      `DELETE FROM veiculos WHERE codigo = 'I-001'`,
      `DELETE FROM condutores WHERE matricula = 'I-1'`,
      `DELETE FROM reservas`,
      `DELETE FROM reserva_eventos`,
      `DELETE FROM usuarios WHERE email = 'inativo@teste.local'`,
      `UPDATE reserva_eventos SET observacao = 'alterado'`,
    ];
    for (const sql of tentativas) {
      await expect(pool.query(sql)).rejects.toThrow(/não podem ser excluídos|não pode ser alterado/);
    }
    // Inativação sem data é recusada pela restrição do banco
    await expect(pool.query(`UPDATE veiculos SET inativado_em = NULL WHERE codigo = 'I-003'`)).rejects.toThrow(/veiculos_inativacao_coerente/);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM reserva_eventos');
    expect(rows[0].n).toBeGreaterThan(0);
  });

  test('CT70 — inativação e empréstimo simultâneos do mesmo veículo: o resultado é sempre coerente', async () => {
    const [inativacao, emprestimo] = await Promise.all([inativar('I-002', { motivo: 'Teste de concorrência.' }), emprestar('I-002', 'I-2')]);
    const { rows } = await pool.query<{ ativo: boolean; abertas: number }>(
      `SELECT v.ativo, (SELECT COUNT(*)::int FROM reservas r WHERE r.veiculo_id = v.id AND r.status IN ('agendada', 'em_uso')) AS abertas
         FROM veiculos v WHERE v.codigo = 'I-002'`
    );
    if (inativacao.status === 200) {
      expect(emprestimo.status).toBe(422);
      expect(rows[0]).toEqual({ ativo: false, abertas: 0 });
    } else {
      expect(inativacao.status).toBe(409);
      expect(emprestimo.status).toBe(201);
      expect(rows[0]).toEqual({ ativo: true, abertas: 1 });
    }
  });
});
