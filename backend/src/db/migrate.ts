import fs from 'fs';
import path from 'path';
import { pool } from './pool';

/**
 * Aplica, em ordem, os arquivos .sql de database/migrations que ainda não foram executados.
 * O controle fica na tabela schema_migrations, permitindo recriar o banco de forma reproduzível.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

export async function runMigrations(log = true): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome TEXT PRIMARY KEY,
        aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs.existsSync(MIGRATIONS_DIR)
      ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
      : [];

    const { rows } = await client.query<{ nome: string }>('SELECT nome FROM schema_migrations');
    const done = new Set(rows.map((r) => r.nome));

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        if (log) console.log(`Migration aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    if (log && applied.length === 0) console.log('Banco já está atualizado.');
    return applied;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((error) => {
      console.error('Falha ao aplicar migrations:', error.message);
      process.exit(1);
    });
}
