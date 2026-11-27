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

// ------------------------------------------------------------------ Condutores (Sprint 02)

export type CategoriaCnh = 'A' | 'B' | 'C' | 'D' | 'E' | 'AB' | 'AC' | 'AD' | 'AE';
export const CATEGORIAS_CNH: CategoriaCnh[] = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];

export type SituacaoCnh = 'valida' | 'vencendo' | 'vencida';
export const SITUACAO_CNH_LABELS: Record<SituacaoCnh, string> = {
  valida: 'CNH válida',
  vencendo: 'CNH vencendo',
  vencida: 'CNH vencida',
};

export interface Condutor {
  id: string;
  nome: string;
  matricula: string;
  cnh_categoria: CategoriaCnh;
  /** Data no formato AAAA-MM-DD */
  cnh_validade: string;
  situacao_cnh: SituacaoCnh;
  telefone: string | null;
  liberado_pool: boolean;
  ativo: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface CondutorInput {
  nome: string;
  matricula: string;
  cnh_categoria: CategoriaCnh;
  cnh_validade: string;
  telefone: string | null;
  liberado_pool: boolean;
  observacoes: string | null;
  ativo?: boolean;
}

export interface ResumoCondutores {
  total: number;
  liberados_pool: number;
  cnh_vencendo: number;
  cnh_vencida: number;
}

export interface FiltrosCondutores {
  busca?: string;
  situacao_cnh?: SituacaoCnh | '';
  liberado_pool?: 'true' | 'false' | '';
  ativo?: 'true' | 'false';
}
