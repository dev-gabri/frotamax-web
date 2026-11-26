import dotenv from 'dotenv';

// Os testes usam sempre o banco de testes (DATABASE_URL_TEST), nunca o de desenvolvimento.
dotenv.config();
process.env.NODE_ENV = 'test';
