import request from 'supertest';
import { pool } from '../src/db/pool';
import { app, encerrar, prepararBanco, token } from './helpers';

let gestor: string;
let consulta: string;
const ids: Record<string, string> = {};

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const HORA = 3_600_000;
/** Data/hora ISO deslocada em horas a partir de agora. */
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

  // Veículos POOL extras: um livre, um em manutenção e um usado no teste de concorrência
  await pool.query(
    `INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, quilometragem, modalidade, situacao) VALUES
      ('T-003', 'CCC3C33', 'Toyota', 'Corolla', 'sedan', 'Unidade A', 5000, 'pool', 'disponivel'),
      ('T-004', 'DDD4D44', 'Renault', 'Kwid', 'hatch', 'Unidade A', 8000, 'pool', 'manutencao'),
      ('T-005', 'EEE5E55', 'Hyundai', 'HB20', 'hatch', 'Unidade B', 1000, 'pool', 'disponivel')`
  );
  const { rows: v } = await pool.query<{ id: string; codigo: string }>('SELECT id, codigo FROM veiculos');
  for (const r of v) ids[r.codigo] = r.id;

  // Condutores: liberado, liberado com CNH vencendo, não liberado e com CNH vencida
  await pool.query(
    `INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, liberado_pool) VALUES
      ('Condutor Liberado', 'C-1', 'B', $1, TRUE),
      ('Condutor CNH Curta', 'C-2', 'B', $2, TRUE),
      ('Condutor Sem Liberação', 'C-3', 'B', $1, FALSE),
      ('Condutor CNH Vencida', 'C-4', 'B', $3, TRUE)`,
    [dia(365), dia(2), dia(-3)]
  );
  const { rows: c } = await pool.query<{ id: string; matricula: string }>('SELECT id, matricula FROM condutores');
  for (const r of c) ids[r.matricula] = r.id;
});
afterAll(encerrar);

const reserva = (extra: Record<string, unknown> = {}) => ({
  tipo: 'reserva',
  veiculo_id: ids['T-001'],
  condutor_id: ids['C-1'],
  inicio: emHoras(24),
  fim_previsto: emHoras(30),
  finalidade: 'Visita técnica à Unidade B',
  ...extra,
});

describe('Reservas e empréstimos (S2)', () => {
  let reservaId: string;
  let numero: number;

  test('CT31 — gestor registra reserva válida de veículo POOL (201, agendada, com evento de registro)', async () => {
    const res = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ tipo: 'reserva', status: 'agendada', retirada_em: null, veiculo: { placa: 'AAA1A11' }, condutor: { matricula: 'C-1' } });
    reservaId = res.body.data.id;
    numero = res.body.data.numero;
    const det = await request(app).get(`/api/reservas/${reservaId}`).set(auth(consulta));
    expect(det.body.data.eventos.map((e: { evento: string }) => e.evento)).toEqual(['registro']);
  });

  test('CT32 — período conflitante para o mesmo veículo é rejeitado (409); período encostado é aceito (CA04)', async () => {
    const conflito = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ inicio: emHoras(28), fim_previsto: emHoras(34) }));
    expect(conflito.status).toBe(409);
    expect(conflito.body.error).toContain(`nº ${String(numero).padStart(4, '0')}`);

    const original = await request(app).get(`/api/reservas/${reservaId}`).set(auth(consulta));
    const encostado = await request(app).post('/api/reservas').set(auth(gestor))
      .send(reserva({ inicio: original.body.data.fim_previsto, fim_previsto: emHoras(36) }));
    expect(encostado.status).toBe(201);
  });

  test('CT33 — veículo de uso atribuído e veículo em manutenção não podem ser reservados (422)', async () => {
    const atribuido = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ veiculo_id: ids['T-002'] }));
    expect(atribuido.status).toBe(422);
    expect(atribuido.body.error).toContain('uso atribuído');
    const manutencao = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ veiculo_id: ids['T-004'] }));
    expect(manutencao.status).toBe(422);
    expect(manutencao.body.error).toContain('em manutenção');
  });

  test('CT34 — condutor sem liberação para o POOL ou com CNH vencida não recebe veículo (422)', async () => {
    const semLiberacao = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ veiculo_id: ids['T-003'], condutor_id: ids['C-3'] }));
    expect(semLiberacao.status).toBe(422);
    expect(semLiberacao.body.error).toContain('não está liberado');
    const vencida = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ veiculo_id: ids['T-003'], condutor_id: ids['C-4'] }));
    expect(vencida.status).toBe(422);
    expect(vencida.body.error).toContain('venceu em');
    const venceNoPeriodo = await request(app).post('/api/reservas').set(auth(gestor))
      .send(reserva({ veiculo_id: ids['T-003'], condutor_id: ids['C-2'], inicio: emHoras(24), fim_previsto: emHoras(24 * 5) }));
    expect(venceNoPeriodo.status).toBe(422);
    expect(venceNoPeriodo.body.error).toContain('antes do fim do período');
  });

  test('CT35 — dados inválidos: período invertido, início no passado, campos ausentes (422/400)', async () => {
    const invertido = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ inicio: emHoras(50), fim_previsto: emHoras(49) }));
    expect(invertido.status).toBe(422);
    const passado = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ inicio: emHoras(-3), fim_previsto: emHoras(2) }));
    expect(passado.status).toBe(422);
    expect(passado.body.error).toContain('não pode estar no passado');
    const incompleto = await request(app).post('/api/reservas').set(auth(gestor)).send({ tipo: 'reserva', veiculo_id: ids['T-003'] });
    expect(incompleto.status).toBe(400);
    expect(incompleto.body.details).toEqual(expect.arrayContaining(['O campo Condutor é obrigatório.', 'O campo Finalidade é obrigatório.']));
    const emprestimoComInicio = await request(app).post('/api/reservas').set(auth(gestor))
      .send(reserva({ tipo: 'emprestimo', veiculo_id: ids['T-003'] }));
    expect(emprestimoComInicio.status).toBe(400);
  });

  test('CT36 — empréstimo registra a retirada imediata e coloca o veículo em uso', async () => {
    const res = await request(app).post('/api/reservas').set(auth(gestor))
      .send({ tipo: 'emprestimo', veiculo_id: ids['T-003'], condutor_id: ids['C-1'], fim_previsto: emHoras(4), finalidade: 'Entrega de documentos' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('em_uso');
    expect(res.body.data.retirada_em).not.toBeNull();
    const veiculo = await request(app).get(`/api/veiculos/${ids['T-003']}`).set(auth(consulta));
    expect(veiculo.body.data.situacao).toBe('em_uso');

    const outro = await request(app).post('/api/reservas').set(auth(gestor))
      .send({ tipo: 'emprestimo', veiculo_id: ids['T-003'], condutor_id: ids['C-2'], fim_previsto: emHoras(1), finalidade: 'Outra saída' });
    expect(outro.status).toBe(409);
  });

  test('CT37 — consulta de disponibilidade lista só veículos POOL livres no período', async () => {
    const res = await request(app).get('/api/reservas/disponibilidade').set(auth(consulta))
      .query({ inicio: emHoras(25), fim: emHoras(26) });
    expect(res.status).toBe(200);
    const placas = res.body.data.map((v: { placa: string }) => v.placa);
    expect(placas).toContain('EEE5E55');
    expect(placas).not.toContain('AAA1A11'); // reservado no período (CT31)
    expect(placas).not.toContain('BBB2B22'); // uso atribuído
    expect(placas).not.toContain('DDD4D44'); // em manutenção
    const agora = await request(app).get('/api/reservas/disponibilidade').set(auth(consulta)).query({ tipo: 'emprestimo', fim: emHoras(2) });
    expect(agora.body.data.map((v: { placa: string }) => v.placa)).not.toContain('CCC3C33'); // emprestado (CT36)
  });

  test('CT38 — retirada de reserva agendada coloca a reserva e o veículo em uso; nova retirada é recusada', async () => {
    const nova = await request(app).post('/api/reservas').set(auth(gestor))
      .send(reserva({ veiculo_id: ids['T-005'], inicio: emHoras(0.5), fim_previsto: emHoras(3) }));
    expect(nova.status).toBe(201);
    const ret = await request(app).post(`/api/reservas/${nova.body.data.id}/retirada`).set(auth(gestor));
    expect(ret.status).toBe(200);
    expect(ret.body.data.status).toBe('em_uso');
    expect((await request(app).get(`/api/veiculos/${ids['T-005']}`).set(auth(consulta))).body.data.situacao).toBe('em_uso');
    const det = await request(app).get(`/api/reservas/${nova.body.data.id}`).set(auth(consulta));
    expect(det.body.data.eventos.map((e: { evento: string }) => e.evento)).toEqual(['registro', 'retirada']);
    expect((await request(app).post(`/api/reservas/${nova.body.data.id}/retirada`).set(auth(gestor))).status).toBe(422);
  });

  test('CT39 — cancelamento exige motivo, libera o período e não se aplica a veículo já retirado', async () => {
    expect((await request(app).post(`/api/reservas/${reservaId}/cancelamento`).set(auth(gestor)).send({})).status).toBe(400);
    const cancel = await request(app).post(`/api/reservas/${reservaId}/cancelamento`).set(auth(gestor)).send({ motivo: 'Reunião adiada pelo fornecedor' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data).toMatchObject({ status: 'cancelada', motivo_cancelamento: 'Reunião adiada pelo fornecedor' });
    const mesmoPeriodo = await request(app).post('/api/reservas').set(auth(gestor)).send(reserva({ inicio: emHoras(25), fim_previsto: emHoras(27) }));
    expect(mesmoPeriodo.status).toBe(201);

    const emUso = await request(app).get('/api/reservas?status=em_uso').set(auth(consulta));
    const idEmUso = emUso.body.data[0].id;
    expect((await request(app).post(`/api/reservas/${idEmUso}/cancelamento`).set(auth(gestor)).send({ motivo: 'Tentativa indevida' })).status).toBe(422);
  });

  test('CT40 — perfil de consulta acompanha as reservas, mas não registra, retira nem cancela (403); sem login, 401', async () => {
    const lista = await request(app).get('/api/reservas').set(auth(consulta));
    expect(lista.status).toBe(200);
    expect(lista.body.data[0].status).toBe('em_uso'); // em uso aparece primeiro
    const agendada = lista.body.data.find((r: { status: string }) => r.status === 'agendada');
    expect((await request(app).post('/api/reservas').set(auth(consulta)).send(reserva({ inicio: emHoras(100), fim_previsto: emHoras(101) }))).status).toBe(403);
    expect((await request(app).post(`/api/reservas/${agendada.id}/retirada`).set(auth(consulta))).status).toBe(403);
    expect((await request(app).post(`/api/reservas/${agendada.id}/cancelamento`).set(auth(consulta)).send({ motivo: 'Sem permissão' })).status).toBe(403);
    expect((await request(app).get('/api/reservas')).status).toBe(401);
  });

  test('CT41 — integridade: veículo emprestado e condutor com reserva em aberto não podem ser alterados de forma incoerente', async () => {
    const situacao = await request(app).patch(`/api/veiculos/${ids['T-003']}/situacao`).set(auth(gestor)).send({ situacao: 'disponivel' });
    expect(situacao.status).toBe(409);
    expect(situacao.body.error).toContain('devolução');
    const manual = await request(app).patch(`/api/veiculos/${ids['T-001']}/situacao`).set(auth(gestor)).send({ situacao: 'em_uso' });
    expect(manual.status).toBe(422);
    const atribuir = await request(app).put(`/api/veiculos/${ids['T-001']}`).set(auth(gestor)).send({ modalidade: 'atribuido' });
    expect(atribuir.status).toBe(409);
    const inativar = await request(app).put(`/api/condutores/${ids['C-1']}`).set(auth(gestor)).send({ ativo: false });
    expect(inativar.status).toBe(409);
  });

  test('CT42 — dois registros simultâneos para o mesmo veículo e período: apenas um é aceito', async () => {
    await pool.query(`INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, modalidade, situacao)
                      VALUES ('T-006', 'FFF6F66', 'Fiat', 'Mobi', 'hatch', 'Unidade A', 'pool', 'disponivel')`);
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM veiculos WHERE codigo = 'T-006'`);
    const corpo = reserva({ veiculo_id: rows[0].id, inicio: emHoras(72), fim_previsto: emHoras(74) });
    const respostas = await Promise.all([1, 2, 3].map(() => request(app).post('/api/reservas').set(auth(gestor)).send(corpo)));
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });
});
