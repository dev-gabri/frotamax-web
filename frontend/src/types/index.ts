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
  meta?: Paginacao;
}

/** Paginação das consultas que podem crescer com o uso (Sprint 03). */
export interface Paginacao {
  pagina: number;
  por_pagina: number;
  total: number;
}

export interface Pagina<T> {
  itens: T[];
  meta: Paginacao;
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
  /** Inativação (Sprint 04): o veículo sai da operação, mas o histórico é preservado. */
  ativo: boolean;
  inativado_em: string | null;
  motivo_inativacao: string | null;
  inativado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type VeiculoInput = Omit<Veiculo,
  'id' | 'criado_em' | 'atualizado_em' | 'ativo' | 'inativado_em' | 'motivo_inativacao' | 'inativado_por_nome'>;

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
  /** Cadastros ativos (padrão) ou inativos */
  ativo?: 'true' | 'false';
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
  /** Inativação em vigor (Sprint 04) */
  inativado_em: string | null;
  motivo_inativacao: string | null;
  inativado_por_nome: string | null;
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
  /** Só acompanha a inativação */
  motivo_inativacao?: string;
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

// ------------------------------------------------------------------ Reservas e empréstimos (Sprint 02)

export type TipoReserva = 'reserva' | 'emprestimo';
export type StatusReserva = 'agendada' | 'em_uso' | 'cancelada' | 'concluida';

export const TIPO_RESERVA_LABELS: Record<TipoReserva, string> = {
  reserva: 'Reserva',
  emprestimo: 'Empréstimo',
};

export const STATUS_RESERVA_LABELS: Record<StatusReserva, string> = {
  agendada: 'Agendada',
  em_uso: 'Em uso',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

export interface Reserva {
  id: string;
  numero: number;
  tipo: TipoReserva;
  status: StatusReserva;
  inicio: string;
  fim_previsto: string;
  retirada_em: string | null;
  devolvida_em: string | null;
  finalidade: string;
  observacoes: string | null;
  motivo_cancelamento: string | null;
  atrasada: boolean;
  criado_em: string;
  /** Devolução (Sprint 03) */
  km_retirada: number | null;
  km_devolucao: number | null;
  km_percorridos: number | null;
  observacao_devolucao: string | null;
  enviado_manutencao: boolean;
  devolvida_com_atraso: boolean;
  veiculo: {
    id: string; codigo: string; placa: string; marca: string; modelo: string; quilometragem: number; situacao: Situacao;
  };
  condutor: { id: string; nome: string; matricula: string };
}

export interface EventoReserva {
  evento: 'registro' | 'retirada' | 'cancelamento' | 'devolucao';
  observacao: string | null;
  criado_em: string;
  usuario: string | null;
}

export interface ReservaDetalhe extends Reserva {
  eventos: EventoReserva[];
}

export interface ReservaInput {
  tipo: TipoReserva;
  veiculo_id: string;
  condutor_id: string;
  inicio?: string;
  fim_previsto: string;
  finalidade: string;
  observacoes: string | null;
}

export interface ResumoReservas {
  agendadas: number;
  em_uso: number;
  atrasadas: number;
  retiradas_hoje: number;
}

export type PrazoReserva = 'atrasadas' | 'retiradas_hoje';

export const PRAZO_LABELS: Record<PrazoReserva, string> = {
  atrasadas: 'Devoluções atrasadas',
  retiradas_hoje: 'Retiradas previstas para hoje',
};

export interface FiltrosReservas {
  busca?: string;
  status?: StatusReserva | '';
  tipo?: TipoReserva | '';
  /** Período no formato AAAA-MM-DD (Sprint 03) */
  de?: string;
  ate?: string;
  /** Atalhos da tela inicial (Sprint 04): mesma regra dos indicadores */
  prazo?: PrazoReserva | '';
  pagina?: number;
  por_pagina?: number;
}

// ------------------------------------------------------------------ Devolução e histórico (Sprint 03)

export interface DevolucaoInput {
  /** Omitida quando o usuário mantém o horário atual: a API usa o horário exato do registro */
  devolvida_em?: string;
  km_devolucao: number;
  observacao: string | null;
  enviar_manutencao: boolean;
}

export interface ReservaAfetada {
  numero: number;
  inicio: string;
  fim_previsto: string;
  condutor: string;
}

export interface ResultadoDevolucao extends Reserva {
  reservas_afetadas: ReservaAfetada[];
}

export interface ResumoHistorico {
  movimentacoes: number;
  concluidas: number;
  canceladas: number;
  em_aberto: number;
  devolvidas_com_atraso: number;
  km_percorridos: number;
  ultima_devolucao: string | null;
}

export interface HistoricoUtilizacao {
  veiculo?: { id: string; codigo: string; placa: string; marca: string; modelo: string; quilometragem: number; situacao: Situacao; ativo: boolean };
  condutor?: { id: string; nome: string; matricula: string; ativo: boolean };
  resumo: ResumoHistorico;
  itens: Reserva[];
  meta: Paginacao;
}

export interface VeiculoDisponivel {
  id: string;
  codigo: string;
  placa: string;
  marca: string;
  modelo: string;
  tipo: TipoVeiculo;
  unidade: string;
  situacao: Situacao;
}
