import request from 'supertest';
import { app, encerrar, prepararBanco, SENHA, token } from './helpers';
import { limparTentativas } from '../src/routes/auth';

let gestor: string;

beforeAll(async () => {
  await prepararBanco();
  gestor = await token('gestor');
});
afterAll(encerrar);

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Revisão de segurança e validação de entradas (Sprint 04)', () => {
  test('CT55 — datas que não existem no calendário são recusadas em vez de convertidas (BUG-07)', async () => {
    const condutor = { nome: 'Teste de Datas', matricula: 'DT-01', cnh_categoria: 'B' };

    // 30/02 era aceito e gravado como 02/03
    let res = await request(app).post('/api/condutores').set(auth(gestor)).send({ ...condutor, cnh_validade: '2027-02-30' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining(['O campo Validade da CNH contém uma data que não existe no calendário.']));
    const { body } = await request(app).get('/api/condutores?busca=DT-01').set(auth(gestor));
    expect(body.data).toHaveLength(0);

    // 29/02 só existe em ano bissexto
    res = await request(app).post('/api/condutores').set(auth(gestor)).send({ ...condutor, cnh_validade: '2028-02-29' });
    expect(res.status).toBe(201);
    expect(res.body.data.cnh_validade).toBe('2028-02-29');

    // Filtro de período: antes respondia 500 (erro do banco)
    res = await request(app).get('/api/reservas?de=2026-04-31').set(auth(gestor));
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining(['O campo Data inicial contém uma data que não existe no calendário.']));

    // Datas com horário (reserva e consulta de disponibilidade)
    res = await request(app).get('/api/reservas/disponibilidade?tipo=reserva&inicio=2027-02-29T08:00&fim=2027-03-01T18:00').set(auth(gestor));
    expect(res.status).toBe(400);
  });

  test('CT56 — corpo acima do limite recebe 413 com mensagem clara, sem erro interno (BUG-08)', async () => {
    const res = await request(app).post('/api/veiculos').set(auth(gestor)).send({ modelo: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, error: 'Os dados enviados excedem o tamanho permitido.' });
  });

  test('CT57 — muitas falhas de login da mesma origem, com e-mails diferentes, bloqueiam a origem (BUG-09)', async () => {
    limparTentativas();
    // 20 e-mails diferentes, uma tentativa cada: nenhum chega ao limite de 5 por e-mail
    for (let i = 0; i < 20; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: `alvo${i}@teste.local`, senha: 'senha-testada' });
      expect(r.status).toBe(401);
    }
    const bloqueado = await request(app).post('/api/auth/login').send({ email: 'gestor@teste.local', senha: SENHA });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error).toBe('Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');

    limparTentativas(); // fim da janela de bloqueio
    const liberado = await request(app).post('/api/auth/login').send({ email: 'gestor@teste.local', senha: SENHA });
    expect(liberado.status).toBe(200);
  }, 60_000); // cada falha compara a senha com bcrypt de propósito (resposta lenta para quem tenta adivinhar)
});
