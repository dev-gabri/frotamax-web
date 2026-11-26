import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuração central da API.
 * Os valores vêm de variáveis de ambiente (arquivo .env local, nunca versionado).
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT || 3001),
  databaseUrl: nodeEnv === 'test'
    ? required('DATABASE_URL_TEST')
    : required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};

if (env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
}
