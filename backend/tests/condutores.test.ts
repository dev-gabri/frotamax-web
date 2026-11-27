import request from 'supertest';
import { app, encerrar, prepararBanco, token } from './helpers';

let gestor: string;
let consulta: string;

beforeAll(async () => {
  await prepararBanco();
  gestor = await token('gestor');
  consulta = await token('consulta');
});
afterAll(encerrar);

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Data AAAA-MM-DD deslocada em dias a partir de hoje. */
const dia = (deslocamento: number) => {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const novoCondutor = {
  nome: 'Ana Paula Ribeiro',
  matricula: 'm-2001',
  cnh_categoria: 'b',
  cnh_validade: dia(400),
  telefone: '(62) 90000-0001',
};

describe('API de condutores (S2)', () => {
  let criadoId: string;

  test('CT25 — gestor cadastra condutor; matrícula e categoria são normalizadas', async () => {
    const res = await request(app).post('/api/condutores').set(auth(gestor)).send(novoCondutor);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      matricula: 'M-2001', cnh_categoria: 'B', cnh_validade: novoCondutor.cnh_validade,
      situacao_cnh: 'valida', liberado_pool: false, ativo: true,
    });
    criadoId = res.body.data.id;
  });

  test('CT26 — campos obrigatórios e formatos inválidos são rejeitados com mensagens claras (400)', async () => {
    const res = await request(app).post('/api/condutores').set(auth(gestor))
      .send({ matricula: 'M 3000', cnh_categoria: 'Z', cnh_validade: '31/12/2030' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      'O campo Nome é obrigatório.',
      'A matrícula deve conter apenas letras, números, ponto e hífen.',
      'O campo Categoria da CNH possui um valor não permitido.',
      'O campo Validade da CNH deve conter uma data válida.',
    ]));
  });

  test('CT27 — matrícula já cadastrada é recusada (409)', async () => {
    const res = await request(app).post('/api/condutores').set(auth(gestor)).send({ ...novoCondutor, nome: 'Outro Nome', matricula: 'M-2001' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Já existe um condutor cadastrado com esta matrícula.');
  });

  test('CT28 — perfil de consulta lista, mas não cadastra nem edita (403); sem login, 401', async () => {
    expect((await request(app).get('/api/condutores').set(auth(consulta))).status).toBe(200);
    expect((await request(app).post('/api/condutores').set(auth(consulta)).send({ ...novoCondutor, matricula: 'M-9' })).status).toBe(403);
    expect((await request(app).put(`/api/condutores/${criadoId}`).set(auth(consulta)).send({ liberado_pool: true })).status).toBe(403);
    expect((await request(app).get('/api/condutores')).status).toBe(401);
  });

  test('CT29 — gestor libera o condutor para o POOL e a alteração persiste', async () => {
    const res = await request(app).put(`/api/condutores/${criadoId}`).set(auth(gestor)).send({ liberado_pool: true, telefone: '' });
    expect(res.status).toBe(200);
    const consultaRes = await request(app).get(`/api/condutores/${criadoId}`).set(auth(consulta));
    expect(consultaRes.body.data).toMatchObject({ liberado_pool: true, telefone: null });
  });

  test('CT30 — situação da CNH é calculada (válida, vencendo, vencida) e usada nos filtros e no resumo', async () => {
    await request(app).post('/api/condutores').set(auth(gestor)).send({ ...novoCondutor, nome: 'Vence Logo', matricula: 'M-2002', cnh_validade: dia(10) });
    await request(app).post('/api/condutores').set(auth(gestor)).send({ ...novoCondutor, nome: 'Já Vencida', matricula: 'M-2003', cnh_validade: dia(-1) });

    const vencidas = await request(app).get('/api/condutores?situacao_cnh=vencida').set(auth(consulta));
    expect(vencidas.body.data.map((c: { matricula: string }) => c.matricula)).toEqual(['M-2003']);
    const vencendo = await request(app).get('/api/condutores?situacao_cnh=vencendo').set(auth(consulta));
    expect(vencendo.body.data.map((c: { matricula: string }) => c.matricula)).toEqual(['M-2002']);
    const liberados = await request(app).get('/api/condutores?liberado_pool=true').set(auth(consulta));
    expect(liberados.body.data).toHaveLength(1);

    const resumo = await request(app).get('/api/condutores/resumo').set(auth(consulta));
    expect(resumo.body.data).toEqual({ total: 3, liberados_pool: 1, cnh_vencendo: 1, cnh_vencida: 1 });
  });
});
