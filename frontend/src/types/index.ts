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

export type TipoVeiculo = 'hatch' | 'sedan' | 'suv' | 'picape' | 'utilitario' | 'caminhao' | 'outro';
export type Modalidade = 'pool' | 'atribuido';
export type Situacao = 'disponivel' | 'em_uso' | 'manutencao' | 'indisponivel';

export const TIPO_LABELS: Record<TipoVeiculo, string> = {
  hatch: 'Hatch',
  sedan: 'Sedan',
  suv: 'SUV',
  picape: 'Picape',
  utilitario: 'Utilitário',
  caminhao: 'Caminhão',
  outro: 'Outro',
};

export const MODALIDADE_LABELS: Record<Modalidade, string> = {
  pool: 'Pool (compartilhado)',
  atribuido: 'Uso atribuído',
};

export const SITUACAO_LABELS: Record<Situacao, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  manutencao: 'Em manutenção',
  indisponivel: 'Indisponível',
};

export interface Veiculo {
  id: string;
  codigo: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number | null;
  tipo: TipoVeiculo;
  unidade: string;
  quilometragem: number;
  modalidade: Modalidade;
  situacao: Situacao;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type VeiculoInput = Omit<Veiculo, 'id' | 'criado_em' | 'atualizado_em'>;

export interface ResumoVeiculos {
  total: number;
  disponivel: number;
  em_uso: number;
  manutencao: number;
  indisponivel: number;
}

export interface FiltrosVeiculos {
  busca?: string;
  situacao?: Situacao | '';
  tipo?: TipoVeiculo | '';
  modalidade?: Modalidade | '';
}
