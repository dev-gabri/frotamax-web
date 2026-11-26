import bcrypt from 'bcryptjs';
import request from 'supertest';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { createApp } from '../src/app';
import { limparTentativas } from '../src/routes/auth';

export const app = createApp();
export const SENHA = 'Senha@Teste123';

/** Recria o banco de testes do zero e carrega usuários e veículos fictícios conhecidos. */
export async function prepararBanco() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(false);
  limparTentativas();

  const hash = await bcrypt.hash(SENHA, 4);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES
      ('Admin Teste', 'admin@teste.local', $1, 'admin', TRUE),
      ('Gestor Teste', 'gestor@teste.local', $1, 'gestor_frota', TRUE),
      ('Consulta Teste', 'consulta@teste.local', $1, 'visualizador', TRUE),
      ('Inativo Teste', 'inativo@teste.local', $1, 'gestor_frota', FALSE)`,
    [hash]
  );
  await pool.query(
    `INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, quilometragem, modalidade, situacao) VALUES
      ('T-001', 'AAA1A11', 'Fiat', 'Strada', 'picape', 'Unidade A', 10000, 'pool', 'disponivel'),
      ('T-002', 'BBB2B22', 'Chevrolet', 'Onix', 'hatch', 'Unidade B', 20000, 'atribuido', 'em_uso')`
  );
}

export async function token(perfil: 'admin' | 'gestor' | 'consulta') {
  const res = await request(app).post('/api/auth/login').send({ email: `${perfil}@teste.local`, senha: SENHA });
  return res.body.data.token as string;
}

export async function encerrar() {
  await pool.end();
}
