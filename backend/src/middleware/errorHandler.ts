import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Default error
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Erro interno do servidor';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Dados inválidos fornecidos';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Acesso não autorizado';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Acesso negado';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Recurso não encontrado';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Serviço temporariamente indisponível';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado'
  });
};