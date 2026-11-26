import { Perfil } from '../types';

/**
 * Matriz de permissões do MVP.
 * A autorização é sempre verificada no back-end. A interface apenas oculta
 * as ações que o perfil não pode executar.
 */
export const PERMISSOES = {
  /** Listar e consultar veículos */
  'veiculos:consultar': ['admin', 'gestor_frota', 'visualizador'],
  /** Cadastrar, editar e alterar a situação de veículos */
  'veiculos:gerenciar': ['admin', 'gestor_frota'],
} as const satisfies Record<string, readonly Perfil[]>;

export type Permissao = keyof typeof PERMISSOES;

export function possuiPermissao(perfil: Perfil, permissao: Permissao): boolean {
  return (PERMISSOES[permissao] as readonly Perfil[]).includes(perfil);
}
