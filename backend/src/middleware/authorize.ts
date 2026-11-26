import { NextFunction, Response } from 'express';
import { Permissao, possuiPermissao } from '../config/permissoes';
import { AuthenticatedRequest } from '../types';
import { AppError } from './errorHandler';

/**
 * Autoriza a operação conforme o perfil do usuário autenticado.
 * Deve ser usado depois de authenticate. Retorna 403 quando o perfil não tem a permissão.
 */
export const authorize = (permissao: Permissao) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.usuario) return next(new AppError(401, 'Autenticação necessária.'));
    if (!possuiPermissao(req.usuario.perfil, permissao)) {
      return next(new AppError(403, 'Você não tem permissão para executar esta operação.'));
    }
    next();
  };
