import { Request } from 'express';

export type Perfil = 'admin' | 'gestor_frota' | 'visualizador';

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface AuthenticatedRequest extends Request {
  usuario?: UsuarioAutenticado;
}
