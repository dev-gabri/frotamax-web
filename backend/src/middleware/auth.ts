import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { query } from '../db/pool';
import { AuthenticatedRequest, UsuarioAutenticado } from '../types';
import { AppError } from './errorHandler';

interface TokenPayload {
  sub: string;
}

/**
 * Exige um token JWT válido (cabeçalho Authorization: Bearer <token>).
 * O usuário é sempre recarregado do banco para garantir que continua ativo
 * e que o perfil considerado é o atual, e não o gravado no token.
 */
export const authenticate = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'Autenticação necessária.');
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(header.slice(7), env.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    } catch {
      throw new AppError(401, 'Sessão inválida ou expirada. Faça login novamente.');
    }

    const { rows } = await query<UsuarioAutenticado & { ativo: boolean }>(
      'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1',
      [payload.sub]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.ativo) {
      throw new AppError(401, 'Sessão inválida ou expirada. Faça login novamente.');
    }

    req.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
    next();
  } catch (error) {
    next(error);
  }
};

export function gerarToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}
