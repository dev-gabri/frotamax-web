import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { app, encerrar, prepararBanco, SENHA, token } from './helpers';
import * as banco from '../src/db/pool';
import { env } from '../src/config/env';
import authRoutes, { limparTentativas } from '../src/routes/auth';
import veiculosRoutes from '../src/routes/veiculos';
import condutoresRoutes from '../src/routes/condutores';
import reservasRoutes from '../src/routes/reservas';

let gestor: string;

beforeAll(async () => {
  await prepararBanco();
  gestor = await token('gestor');
});
afterAll(encerrar);

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Módulos de rotas montados em app.ts. Um módulo novo precisa entrar aqui para ser verificado. */
const MODULOS: [string, Router][] = [
  ['/api/auth', authRoutes],
  ['/api/veiculos', veiculosRoutes],
  ['/api/condutores', condutoresRoutes],
  ['/api/reservas', reservasRoutes],
];
const ID = '00000000-0000-4000-8000-000000000000';
const PUBLICAS = ['POST /api/auth/login'];

interface Rota { metodo: 'get' | 'post' | 'put' | 'patch' | 'delete'; caminho: string }

/** Lê as rotas diretamente dos roteadores do Express, para que nenhuma rota nova fique fora da verificação. */
function todasAsRotas(): Rota[] {
  const rotas: Rota[] = [];
  for (const [prefixo, router] of MODULOS) {
    for (const camada of router.stack) {
      if (!camada.route) continue;
      for (const metodo of Object.keys((camada.route as unknown as { methods: Record<string, boolean> }).methods)) {
        rotas.push({ metodo: metodo as Rota['metodo'], caminho: prefixo + camada.route.path.replace(/:id/g, ID) });
      }
    }
  }
  return rotas;
}
const nome = (r: Rota) => `${r.metodo.toUpperCase()} ${r.caminho.replace(ID, ':id')}`;

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

  test('CT58 — todas as rotas da API, exceto o login, recusam acesso sem sessão válida (401)', async () => {
    // Todos os roteadores montados no app estão na lista verificada
    const montados = (app as unknown as { _router: { stack: { name: string }[] } })._router.stack.filter((c) => c.name === 'router');
    expect(montados).toHaveLength(MODULOS.length);

    const rotas = todasAsRotas().filter((r) => !PUBLICAS.includes(nome(r)));
    expect(rotas.length).toBeGreaterThanOrEqual(20);
    const expirado = jwt.sign({ sub: ID }, env.jwtSecret, { algorithm: 'HS256', expiresIn: -10 });
    const semAssinatura = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(`{"sub":"${ID}"}`).toString('base64url')}.`;
    const falhas: string[] = [];
    for (const rota of rotas) {
      for (const cabecalho of [undefined, `Bearer ${expirado}`, `Bearer ${semAssinatura}`]) {
        const req = request(app)[rota.metodo](rota.caminho);
        if (cabecalho) req.set('Authorization', cabecalho);
        const res = await req.send({});
        if (res.status !== 401) falhas.push(`${nome(rota)} (${cabecalho ? 'token inválido' : 'sem token'}): ${res.status}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  test('CT59 — todas as rotas de alteração recusam o perfil de consulta (403)', async () => {
    const consulta = await token('consulta');
    const alteracoes = todasAsRotas().filter((r) => r.metodo !== 'get' && !PUBLICAS.includes(nome(r)));
    expect(alteracoes.length).toBeGreaterThanOrEqual(8);
    const falhas: string[] = [];
    for (const rota of alteracoes) {
      const res = await request(app)[rota.metodo](rota.caminho).set(auth(consulta)).send({});
      if (res.status !== 403) falhas.push(`${nome(rota)}: ${res.status}`);
    }
    expect(falhas).toEqual([]);
  });

  test('CT60 — usuário desativado perde o acesso imediatamente, mesmo com sessão aberta', async () => {
    const consulta = await token('consulta');
    expect((await request(app).get('/api/veiculos').set(auth(consulta))).status).toBe(200);
    await banco.query("UPDATE usuarios SET ativo = FALSE WHERE email = 'consulta@teste.local'");
    try {
      expect((await request(app).get('/api/veiculos').set(auth(consulta))).status).toBe(401);
    } finally {
      await banco.query("UPDATE usuarios SET ativo = TRUE WHERE email = 'consulta@teste.local'");
    }
  });

  test('CT61 — erros inesperados não expõem detalhes internos (consulta, tabela ou pilha)', async () => {
    const espiao = jest.spyOn(banco, 'query').mockRejectedValueOnce(
      new Error('relation "veiculos" does not exist: SELECT id, placa FROM veiculos WHERE ativo = TRUE'),
    );
    const res = await request(app).get('/api/veiculos/resumo').set(auth(gestor));
    espiao.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno do servidor' });

    const inexistente = await request(app).get('/api/nao-existe').set(auth(gestor));
    expect(inexistente.status).toBe(404);
    expect(JSON.stringify(inexistente.body)).not.toMatch(/stack|node_modules|express/i);
  });

  test('CT62 — cabeçalhos de segurança presentes e CORS restrito à origem configurada', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();

    const outraOrigem = await request(app).options('/api/veiculos')
      .set('Origin', 'https://site-desconhecido.example').set('Access-Control-Request-Method', 'GET');
    // O navegador só libera a resposta quando o cabeçalho coincide com a origem que fez a requisição
    expect(outraOrigem.headers['access-control-allow-origin']).not.toBe('https://site-desconhecido.example');
    expect(outraOrigem.headers['access-control-allow-origin']).not.toBe('*');
    const origemPermitida = await request(app).options('/api/veiculos')
      .set('Origin', env.corsOrigin).set('Access-Control-Request-Method', 'GET');
    expect(origemPermitida.headers['access-control-allow-origin']).toBe(env.corsOrigin);
  });

  test('CT63 — nenhuma consulta devolve hash de senha ou e-mail de outros usuários', async () => {
    const consultas = todasAsRotas().filter((r) => r.metodo === 'get' && !r.caminho.includes(ID));
    for (const rota of consultas) {
      const res = await request(app).get(rota.caminho).set(auth(gestor));
      const corpo = JSON.stringify(res.body);
      expect(corpo).not.toMatch(/senha|\$2[aby]\$/);
      if (rota.caminho !== '/api/auth/me') expect(corpo).not.toMatch(/@teste\.local/);
    }
  });
});
