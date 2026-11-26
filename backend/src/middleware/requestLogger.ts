import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Registra apenas método, rota, status e duração.
 * Não registra corpo da requisição, cabeçalhos, tokens ou senhas.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    if (env.isTest) return;
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
};
