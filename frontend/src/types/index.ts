/** Perfis de acesso definidos para o MVP. */
export type UserRole = 'admin' | 'gestor_frota' | 'visualizador';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor_frota: 'Gestor de Frota',
  visualizador: 'Consulta',
};

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
}
