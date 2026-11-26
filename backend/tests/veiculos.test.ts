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

const novoVeiculo = {
  codigo: 'fm-200',
  placa: 'abc-1d23',
  marca: 'Toyota',
  modelo: 'Corolla',
  ano_modelo: 2024,
  tipo: 'sedan',
  unidade: 'Unidade Matriz',
  quilometragem: 5000,
  modalidade: 'pool',
};

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Autorização (S1-04)', () => {
  test('CT10 — perfil de consulta pode listar veículos', async () => {
    const res = await request(app).get('/api/veiculos').set(auth(consulta));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('CT11 — perfil de consulta não pode cadastrar, editar nem alterar situação (403)', async () => {
    const lista = await request(app).get('/api/veiculos').set(auth(consulta));
    const id = lista.body.data[0].id;
    expect((await request(app).post('/api/veiculos').set(auth(consulta)).send({ ...novoVeiculo, placa: 'XYZ9Z99', codigo: 'X-1' })).status).toBe(403);
    expect((await request(app).put(`/api/veiculos/${id}`).set(auth(consulta)).send({ unidade: 'Outra' })).status).toBe(403);
    expect((await request(app).patch(`/api/veiculos/${id}/situacao`).set(auth(consulta)).send({ situacao: 'manutencao' })).status).toBe(403);
  });

  test('CT12 — API de veículos exige autenticação', async () => {
    expect((await request(app).get('/api/veiculos')).status).toBe(401);
    expect((await request(app).post('/api/veiculos').send(novoVeiculo)).status).toBe(401);
  });
});

describe('API de veículos (S1-10)', () => {
  let criadoId: string;

  test('CT13 — gestor cadastra veículo; placa e código são normalizados', async () => {
    const res = await request(app).post('/api/veiculos').set(auth(gestor)).send(novoVeiculo);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ placa: 'ABC1D23', codigo: 'FM-200', situacao: 'disponivel' });
    criadoId = res.body.data.id;
  });

  test('CT14 — registro persiste e é recuperado em nova consulta', async () => {
    const res = await request(app).get(`/api/veiculos/${criadoId}`).set(auth(consulta));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ modelo: 'Corolla', quilometragem: 5000 });
  });

  test('CT15 — dados obrigatórios ausentes ou inválidos são rejeitados (400)', async () => {
    const res = await request(app).post('/api/veiculos').set(auth(gestor))
      .send({ codigo: '', placa: '1234567', tipo: 'aviao', quilometragem: -1 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      'A placa deve seguir o padrão ABC1234 ou ABC1D23.',
      'O campo Marca é obrigatório.',
      'O campo Tipo possui um valor não permitido.',
      'O campo Quilometragem deve ser maior ou igual a 0.',
    ]));
  });

  test('CT16 — placa ou código já cadastrados são rejeitados (409)', async () => {
    const placa = await request(app).post('/api/veiculos').set(auth(gestor)).send({ ...novoVeiculo, codigo: 'FM-201' });
    expect(placa.status).toBe(409);
    expect(placa.body.error).toBe('Já existe um veículo cadastrado com esta placa.');
    const codigo = await request(app).post('/api/veiculos').set(auth(gestor)).send({ ...novoVeiculo, placa: 'DEF4G56' });
    expect(codigo.status).toBe(409);
  });

  test('CT17 — atualização é aplicada e persistida', async () => {
    const res = await request(app).put(`/api/veiculos/${criadoId}`).set(auth(gestor))
      .send({ unidade: 'Unidade Comercial', quilometragem: 6200, campo_inexistente: 'ignorado' });
    expect(res.status).toBe(200);
    const consultaRes = await request(app).get(`/api/veiculos/${criadoId}`).set(auth(consulta));
    expect(consultaRes.body.data).toMatchObject({ unidade: 'Unidade Comercial', quilometragem: 6200 });
    expect(consultaRes.body.data).not.toHaveProperty('campo_inexistente');
  });

  test('CT18 — quilometragem menor que a registrada é rejeitada (422)', async () => {
    const res = await request(app).put(`/api/veiculos/${criadoId}`).set(auth(gestor)).send({ quilometragem: 100 });
    expect(res.status).toBe(422);
  });

  test('CT19 — alteração de situação atualiza os indicadores', async () => {
    const antes = (await request(app).get('/api/veiculos/resumo').set(auth(consulta))).body.data;
    const res = await request(app).patch(`/api/veiculos/${criadoId}/situacao`).set(auth(gestor)).send({ situacao: 'manutencao' });
    expect(res.status).toBe(200);
    expect(res.body.data.situacao).toBe('manutencao');
    const depois = (await request(app).get('/api/veiculos/resumo').set(auth(consulta))).body.data;
    expect(depois.manutencao).toBe(antes.manutencao + 1);
    expect(depois.disponivel).toBe(antes.disponivel - 1);
  });

  test('CT20 — situação inexistente é rejeitada (400)', async () => {
    const res = await request(app).patch(`/api/veiculos/${criadoId}/situacao`).set(auth(gestor)).send({ situacao: 'voando' });
    expect(res.status).toBe(400);
  });

  test('CT21 — busca e filtros retornam somente os veículos correspondentes', async () => {
    const busca = await request(app).get('/api/veiculos?busca=onix').set(auth(consulta));
    expect(busca.body.data.map((v: { modelo: string }) => v.modelo)).toEqual(['Onix']);
    const filtro = await request(app).get('/api/veiculos?situacao=em_uso&modalidade=atribuido').set(auth(consulta));
    expect(filtro.body.data).toHaveLength(1);
    const invalido = await request(app).get('/api/veiculos?situacao=xyz').set(auth(consulta));
    expect(invalido.status).toBe(400);
  });

  test('CT22 — identificador inválido (400) e veículo inexistente (404)', async () => {
    expect((await request(app).get('/api/veiculos/123').set(auth(consulta))).status).toBe(400);
    const res = await request(app).get('/api/veiculos/3f1c2a64-8d5b-4c1e-9a7e-2b6f0c9d1e11').set(auth(consulta));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Veículo não encontrado.');
  });

  test('CT23 — erros não expõem detalhes internos', async () => {
    const res = await request(app).post('/api/veiculos').set(auth(gestor)).set('Content-Type', 'application/json').send('{"json": inválido');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|SELECT|at \w+ \(/);
  });

  test('CT24 — health check confirma API e banco disponíveis', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ api: 'ok', database: 'ok' });
  });
});
