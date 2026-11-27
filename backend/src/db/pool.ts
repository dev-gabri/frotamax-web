import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { env } from '../config/env';

// Colunas DATE (ex.: validade da CNH) são devolvidas como texto AAAA-MM-DD,
// evitando deslocamento de fuso horário na conversão para Date.
types.setTypeParser(1082, (valor: string) => valor);

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

/** Executa as operações em uma transação: confirma tudo ou desfaz tudo em caso de erro. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
