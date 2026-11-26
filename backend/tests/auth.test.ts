import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, encerrar, prepararBanco, SENHA, token } from './helpers';

beforeAll(prepararBanco);
afterAll(encerrar);

describe('Autenticação (S1-03)', () => {
  test('CT01 — login válido retorna token e dados do usuário sem a senha', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'gestor@teste.local', senha: SENHA });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.usuario).toMatchObject({ email: 'gestor@teste.local', perfil: 'gestor_frota' });
    expect(JSON.stringify(res.body)).not.toContain('senha_hash');
  });

  test('CT02 — e-mail é aceito sem diferenciar maiúsculas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'Gestor@Teste.LOCAL', senha: SENHA });
    expect(res.status).toBe(200);
  });

  test('CT03 — senha incorreta é rejeitada com mensagem genérica', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'gestor@teste.local', senha: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha inválidos.');
  });

  test('CT04 — e-mail inexistente recebe a mesma mensagem (não revela contas)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ninguem@teste.local', senha: 'qualquer' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha inválidos.');
  });

  test('CT05 — campos vazios ou inválidos são rejeitados com orientação', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nao-e-email', senha: '' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining(['O campo Senha é obrigatório.']));
  });

  test('CT06 — usuário inativo não consegue autenticar', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'inativo@teste.local', senha: SENHA });
    expect(res.status).toBe(401);
  });

  test('CT07 — rota protegida recusa acesso sem token e com token inválido ou adulterado', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    const forjado = jwt.sign({ sub: '00000000-0000-4000-8000-000000000000' }, 'segredo-de-outra-aplicacao-com-32-chars!!');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forjado}`)).status).toBe(401);
  });

  test('CT08 — sessão válida retorna o usuário atual', async () => {
    const t = await token('consulta');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'consulta@teste.local', perfil: 'visualizador' });
  });

  test('CT09 — após 5 tentativas falhas o acesso é bloqueado temporariamente', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: 'admin@teste.local', senha: 'errada' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@teste.local', senha: SENHA });
    expect(res.status).toBe(429);
  });
});
