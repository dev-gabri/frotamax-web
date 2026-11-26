import { Pool, QueryResultRow } from 'pg';
import { env } from '../config/env';

/**
 * Conexão única com o PostgreSQL local.
 * Somente o back-end acessa o banco; o front-end consome apenas a API.
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
