import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/** Erro de aplicação com status HTTP e mensagem segura para o usuário. */
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public details?: string[]) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Endpoint não encontrado' });
};

/**
 * Tratamento central de erros: o usuário recebe mensagem compreensível,
 * sem detalhes internos (consultas, stack trace ou dados do banco).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // JSON malformado enviado no corpo da requisição
  if (error instanceof SyntaxError && 'body' in (error as object)) {
    return res.status(400).json({ success: false, error: 'Corpo da requisição inválido.' });
  }

  // Corpo acima do limite aceito pela API (100 KB) ou em codificação não suportada (BUG-08)
  const corpoError = error as { type?: string };
  if (corpoError?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Os dados enviados excedem o tamanho permitido.' });
  }
  if (corpoError?.type === 'encoding.unsupported' || corpoError?.type === 'charset.unsupported') {
    return res.status(415).json({ success: false, error: 'Formato dos dados enviados não suportado.' });
  }

  // Violação de unicidade no PostgreSQL (ex.: placa ou código já cadastrados)
  const pgError = error as { code?: string; constraint?: string };
  if (pgError?.code === '23505') {
    return res.status(409).json({ success: false, error: 'Já existe um registro com estes dados.' });
  }

  if (!env.isTest) console.error('Erro não tratado:', (error as Error)?.message);
  return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
};
