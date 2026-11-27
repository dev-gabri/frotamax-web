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

  // Veículos POOL usados nos ciclos de devolução (T-001 POOL e T-002 atribuído vêm do helper)
  await pool.query(
    `INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, quilometragem, modalidade, situacao) VALUES
      ('D-001', 'FFF1F11', 'Toyota', 'Yaris', 'hatch', 'Unidade A', 30000, 'pool', 'disponivel'),
      ('D-002', 'GGG2G22', 'Fiat', 'Cronos', 'sedan', 'Unidade A', 50000, 'pool', 'disponivel'),
      ('D-003', 'HHH3H33', 'Renault', 'Duster', 'suv', 'Unidade B', 70000, 'pool', 'disponivel'),
      ('D-004', 'JJJ4J44', 'Chevrolet', 'Spin', 'utilitario', 'Unidade B', 15000, 'pool', 'disponivel')`
  );
  const { rows: v } = await pool.query<{ id: string; codigo: string }>('SELECT id, codigo FROM veiculos');
  for (const r of v) ids[r.codigo] = r.id;

  await pool.query(
    `INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, liberado_pool) VALUES
      ('Condutora Um', 'D-1', 'B', $1, TRUE),
      ('Condutor Dois', 'D-2', 'AB', $1, TRUE)`,
    [dia(365)]
  );
  const { rows: c } = await pool.query<{ id: string; matricula: string }>('SELECT id, matricula FROM condutores');
  for (const r of c) ids[r.matricula] = r.id;
});
afterAll(encerrar);

/** Registra um empréstimo (retirada imediata) e devolve a resposta da API. */
const emprestar = (veiculo: string, condutor = 'D-1', horas = 4) => request(app).post('/api/reservas').set(auth(gestor)).send({
  tipo: 'emprestimo', veiculo_id: ids[veiculo], condutor_id: ids[condutor], fim_previsto: emHoras(horas),
  finalidade: 'Visita técnica à Unidade B',
});
const devolver = (id: string, corpo: Record<string, unknown>, t = gestor) =>
  request(app).post(`/api/reservas/${id}/devolucao`).set(auth(t)).send(corpo);
const veiculo = async (codigo: string) =>
  (await pool.query('SELECT situacao, quilometragem FROM veiculos WHERE codigo = $1', [codigo])).rows[0];

describe('Devolução de veículos (S3)', () => {
  let emprestimoId: string;

  test('CT43 — devolução de empréstimo em andamento encerra a movimentação e libera o veículo (CA05)', async () => {
    const emp = await emprestar('D-001');
    expect(emp.status).toBe(201);
    expect(emp.body.data.km_retirada).toBe(30000);
    emprestimoId = emp.body.data.id;

    const res = await devolver(emprestimoId, { km_devolucao: 30125, observacao: 'Sem ocorrências.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'concluida', km_retirada: 30000, km_devolucao: 30125, km_percorridos: 125,
      observacao_devolucao: 'Sem ocorrências.', enviado_manutencao: false, devolvida_com_atraso: false,
    });
    expect(res.body.data.devolvida_em).not.toBeNull();
    expect(await veiculo('D-001')).toEqual({ situacao: 'disponivel', quilometragem: 30125 });

    const det = await request(app).get(`/api/reservas/${emprestimoId}`).set(auth(consulta));
    expect(det.body.data.eventos.map((e: { evento: string }) => e.evento)).toEqual(['registro', 'retirada', 'devolucao']);
    expect(det.body.data.eventos[2].observacao).toContain('30.125 km');
  });

  test('CT44 — após a devolução, o veículo volta a ser oferecido e aceita um novo empréstimo (ciclo completo)', async () => {
    const disp = await request(app).get('/api/reservas/disponibilidade')
      .query({ tipo: 'emprestimo', fim: emHoras(3) }).set(auth(gestor));
    expect(disp.body.data.map((x: { codigo: string }) => x.codigo)).toContain('D-001');

    const novo = await emprestar('D-001', 'D-2');
    expect(novo.status).toBe(201);
    expect(novo.body.data.km_retirada).toBe(30125);
    const fim = await devolver(novo.body.data.id, { km_devolucao: 30200 });
    expect(fim.status).toBe(200);
    expect(fim.body.data.observacao_devolucao).toBeNull();
  });

  test('CT45 — quilometragem de chegada menor que a do veículo é recusada (422) e nada é alterado', async () => {
    const emp = await emprestar('D-002');
    const res = await devolver(emp.body.data.id, { km_devolucao: 49990 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/menor que a registrada/);
    expect(await veiculo('D-002')).toEqual({ situacao: 'em_uso', quilometragem: 50000 });
    const r = await request(app).get(`/api/reservas/${emp.body.data.id}`).set(auth(gestor));
    expect(r.body.data.status).toBe('em_uso');

    const semKm = await devolver(emp.body.data.id, {});
    expect(semKm.status).toBe(400);
    expect(semKm.body.details.join(' ')).toMatch(/Quilometragem de chegada é obrigatório/);

    // Mesma quilometragem (veículo não rodou) é aceita
    const ok = await devolver(emp.body.data.id, { km_devolucao: 50000 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.km_percorridos).toBe(0);
  });

  test('CT46 — devolução só para movimentação em andamento: agendada (422), já devolvida (409), cancelada (422)', async () => {
    const agendada = await request(app).post('/api/reservas').set(auth(gestor)).send({
      tipo: 'reserva', veiculo_id: ids['D-004'], condutor_id: ids['D-1'], inicio: emHoras(48), fim_previsto: emHoras(52),
      finalidade: 'Reunião na Unidade A',
    });
    let res = await devolver(agendada.body.data.id, { km_devolucao: 15100 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/ainda não foi retirado/);

    res = await devolver(emprestimoId, { km_devolucao: 40000 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já foi registrada/);

    await request(app).post(`/api/reservas/${agendada.body.data.id}/cancelamento`).set(auth(gestor)).send({ motivo: 'Reunião desmarcada' });
    res = await devolver(agendada.body.data.id, { km_devolucao: 15100 });
    expect(res.status).toBe(422);

    res = await request(app).post('/api/reservas/00000000-0000-4000-8000-000000000000/devolucao').set(auth(gestor)).send({ km_devolucao: 1 });
    expect(res.status).toBe(404);
  });

  test('CT47 — data e hora da devolução: não pode ser futura nem anterior à retirada; registro posterior com atraso é aceito', async () => {
    const emp = await emprestar('D-004', 'D-2', 1);
    const id = emp.body.data.id;
    let res = await devolver(id, { km_devolucao: 15050, devolvida_em: emHoras(2) });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/futuro/);
    res = await devolver(id, { km_devolucao: 15050, devolvida_em: emHoras(-1) });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/anterior à retirada/);

    // Simula um empréstimo que deveria ter voltado ontem e foi devolvido hoje
    await pool.query(`UPDATE reservas SET inicio = NOW() - INTERVAL '30 hours', retirada_em = NOW() - INTERVAL '30 hours',
                             fim_previsto = NOW() - INTERVAL '24 hours' WHERE id = $1`, [id]);
    const lista = await request(app).get('/api/reservas').query({ status: 'em_uso' }).set(auth(gestor));
    expect(lista.body.data.find((r: { id: string }) => r.id === id).atrasada).toBe(true);
    res = await devolver(id, { km_devolucao: 15300, devolvida_em: emHoras(-2) });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ devolvida_com_atraso: true, atrasada: false });
  });

  test('CT48 — veículo com problema vai para manutenção na devolução; exige descrição e bloqueia novas reservas', async () => {
    // Reserva futura do mesmo veículo, registrada antes do empréstimo de hoje
    const futura = await request(app).post('/api/reservas').set(auth(gestor)).send({
      tipo: 'reserva', veiculo_id: ids['D-003'], condutor_id: ids['D-2'], inicio: emHoras(72), fim_previsto: emHoras(76),
      finalidade: 'Treinamento na Unidade B',
    });
    expect(futura.status).toBe(201);
    const emp = await emprestar('D-003');

    let res = await devolver(emp.body.data.id, { km_devolucao: 70210, enviar_manutencao: true });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Descreva o problema/);

    res = await devolver(emp.body.data.id, { km_devolucao: 70210, enviar_manutencao: true, observacao: 'Ruído na suspensão dianteira.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'concluida', enviado_manutencao: true });
    expect(res.body.data.reservas_afetadas).toHaveLength(1);
    expect(res.body.data.reservas_afetadas[0].numero).toBe(futura.body.data.numero);
    expect(await veiculo('D-003')).toEqual({ situacao: 'manutencao', quilometragem: 70210 });

    const nova = await request(app).post('/api/reservas').set(auth(gestor)).send({
      tipo: 'reserva', veiculo_id: ids['D-003'], condutor_id: ids['D-1'], inicio: emHoras(100), fim_previsto: emHoras(104),
      finalidade: 'Visita técnica',
    });
    expect(nova.status).toBe(422);
    expect(nova.body.error).toMatch(/em manutenção/);
    const retirada = await request(app).post(`/api/reservas/${futura.body.data.id}/retirada`).set(auth(gestor));
    expect(retirada.status).toBe(422);
  });

  test('CT49 — perfil de consulta não registra devolução (403); sem login, 401; dados inválidos, 400', async () => {
    const emp = await emprestar('T-001');
    let res = await devolver(emp.body.data.id, { km_devolucao: 10100 }, consulta);
    expect(res.status).toBe(403);
    res = await request(app).post(`/api/reservas/${emp.body.data.id}/devolucao`).send({ km_devolucao: 10100 });
    expect(res.status).toBe(401);
    res = await devolver(emp.body.data.id, { km_devolucao: -5, observacao: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveLength(2);
    res = await devolver(emp.body.data.id, { km_devolucao: 10100 });
    expect(res.status).toBe(200);
  });

  test('CT50 — duas devoluções simultâneas da mesma movimentação: apenas uma é registrada', async () => {
    const emp = await emprestar('D-002', 'D-2');
    const respostas = await Promise.all([
      devolver(emp.body.data.id, { km_devolucao: 50100 }),
      devolver(emp.body.data.id, { km_devolucao: 50150 }),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM reserva_eventos e JOIN reservas r ON r.id = e.reserva_id
                                        WHERE r.id = $1 AND e.evento = 'devolucao'`, [emp.body.data.id]);
    expect(rows[0].n).toBe(1);
  });
});

describe('Histórico de utilização e consultas (S3)', () => {
  test('CT51 — histórico do veículo reúne as movimentações, das mais recentes para as mais antigas, com resumo (CA08)', async () => {
    const res = await request(app).get(`/api/veiculos/${ids['D-001']}/historico`).set(auth(consulta));
    expect(res.status).toBe(200);
    expect(res.body.data.veiculo).toMatchObject({ codigo: 'D-001', quilometragem: 30200, situacao: 'disponivel' });
    expect(res.body.data.resumo).toMatchObject({ movimentacoes: 2, concluidas: 2, canceladas: 0, em_aberto: 0, km_percorridos: 200 });
    expect(res.body.data.resumo.ultima_devolucao).not.toBeNull();
    const itens = res.body.data.itens;
    expect(itens.map((i: { km_percorridos: number }) => i.km_percorridos)).toEqual([75, 125]);
    expect(itens[0]).toMatchObject({ condutor: { matricula: 'D-2' }, status: 'concluida' });
    expect(res.body.meta).toEqual({ pagina: 1, por_pagina: 50, total: 2 });

    const pag = await request(app).get(`/api/veiculos/${ids['D-001']}/historico`).query({ por_pagina: 1, pagina: 2 }).set(auth(consulta));
    expect(pag.body.data.itens).toHaveLength(1);
    expect(pag.body.data.itens[0].km_percorridos).toBe(125);

    const vazio = await request(app).get(`/api/veiculos/${ids['T-002']}/historico`).set(auth(consulta));
    expect(vazio.body.data.itens).toEqual([]);
    expect(vazio.body.data.resumo.movimentacoes).toBe(0);
    const inexistente = await request(app).get('/api/veiculos/00000000-0000-4000-8000-000000000000/historico').set(auth(consulta));
    expect(inexistente.status).toBe(404);
  });

  test('CT52 — histórico do condutor mostra suas reservas, empréstimos e devoluções', async () => {
    const res = await request(app).get(`/api/condutores/${ids['D-2']}/historico`).set(auth(consulta));
    expect(res.status).toBe(200);
    expect(res.body.data.condutor).toMatchObject({ matricula: 'D-2' });
    const { resumo } = res.body.data;
    expect(resumo.movimentacoes).toBe(res.body.data.itens.length);
    expect(resumo.concluidas).toBeGreaterThanOrEqual(3);
    expect(resumo.em_aberto).toBe(1); // reserva futura do veículo enviado para manutenção
    expect(resumo.devolvidas_com_atraso).toBe(1);
    expect(res.body.data.itens.every((i: { condutor: { matricula: string } }) => i.condutor.matricula === 'D-2')).toBe(true);
  });

  test('CT53 — consulta de movimentações com filtro de período, situação e paginação', async () => {
    const todas = await request(app).get('/api/reservas').set(auth(consulta));
    expect(todas.body.meta.total).toBe(todas.body.data.length);
    // Em andamento e agendadas primeiro; encerradas depois, da mais recente para a mais antiga
    const status = todas.body.data.map((r: { status: string }) => r.status);
    expect(status.indexOf('concluida')).toBeGreaterThan(status.lastIndexOf('agendada'));

    const hoje = await request(app).get('/api/reservas').query({ de: dia(0), ate: dia(0), status: 'concluida' }).set(auth(consulta));
    expect(hoje.body.data.length).toBeGreaterThanOrEqual(5);
    const futuro = await request(app).get('/api/reservas').query({ de: dia(10), ate: dia(20) }).set(auth(consulta));
    expect(futuro.body.data).toEqual([]);
    const invertido = await request(app).get('/api/reservas').query({ de: dia(5), ate: dia(1) }).set(auth(consulta));
    expect(invertido.status).toBe(422);
    const formato = await request(app).get('/api/reservas').query({ de: '27/11/2026' }).set(auth(consulta));
    expect(formato.status).toBe(400);

    const pagina = await request(app).get('/api/reservas').query({ por_pagina: 2, pagina: 2 }).set(auth(consulta));
    expect(pagina.body.data).toHaveLength(2);
    expect(pagina.body.meta).toMatchObject({ pagina: 2, por_pagina: 2, total: todas.body.meta.total });
    expect(pagina.body.data[0].id).toBe(todas.body.data[2].id);
  });

  test('CT54 — histórico preservado: veículo e condutor inativos continuam com o histórico consultável', async () => {
    await pool.query(`UPDATE veiculos SET ativo = FALSE WHERE codigo = 'D-001'`);
    const v = await request(app).get(`/api/veiculos/${ids['D-001']}/historico`).set(auth(consulta));
    expect(v.status).toBe(200);
    expect(v.body.data.veiculo.ativo).toBe(false);
    expect(v.body.data.itens).toHaveLength(2);
    await pool.query(`UPDATE veiculos SET ativo = TRUE WHERE codigo = 'D-001'`);

    // Condutora sem movimentação em aberto pode ser inativada, e o histórico dela continua disponível
    const inativa = await request(app).put(`/api/condutores/${ids['D-1']}`).set(auth(gestor)).send({ ativo: false });
    expect(inativa.status).toBe(200);
    const c = await request(app).get(`/api/condutores/${ids['D-1']}/historico`).set(auth(consulta));
    expect(c.status).toBe(200);
    expect(c.body.data.condutor.ativo).toBe(false);
    expect(c.body.data.resumo.concluidas).toBe(4);
  });
});
