import { env } from '../config/env';
import { pool } from './pool';
import { runMigrations } from './migrate';
import { seed } from './seed';

/**
 * Recria o banco LOCAL de desenvolvimento somente com os dados fictícios de demonstração (Sprint 04).
 * Útil antes de uma demonstração ao Departamento de Frotas, para começar com dados previsíveis.
 * Apaga tudo o que foi registrado no banco local; por isso exige --confirmar e recusa o ambiente de produção.
 *
 * Uso: npm run db:recriar -- --confirmar
 */
async function recriar() {
  if (env.nodeEnv === 'production') {
    throw new Error('Este comando não pode ser usado em produção.');
  }
  if (!process.argv.includes('--confirmar')) {
    console.log('Este comando apaga todos os registros do banco local e carrega de novo os dados fictícios.');
    console.log('Para continuar, execute: npm run db:recriar -- --confirmar');
    return;
  }
  const banco = new URL(env.databaseUrl).pathname.slice(1);
  console.log(`Recriando o banco local "${banco}" com os dados fictícios de demonstração...`);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations();
  await seed();
}

recriar()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Falha ao recriar o banco local:', (error as Error).message);
    await pool.end();
    process.exit(1);
  });
