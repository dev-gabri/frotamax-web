import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { checkDatabase } from './db/pool';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Monta a aplicação Express sem iniciar o servidor,
 * o que permite reutilizá-la nos testes automatizados.
 */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  app.get('/api/health', async (_req, res) => {
    const database = await checkDatabase();
    res.status(database ? 200 : 503).json({
      success: database,
      data: { api: 'ok', database: database ? 'ok' : 'indisponível' },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
