import { apiService } from './apiService';
import {
  DevolucaoInput,
  FiltrosReservas,
  HistoricoUtilizacao,
  Pagina,
  Reserva,
  ReservaDetalhe,
  ReservaInput,
  ResultadoDevolucao,
  ResumoReservas,
  TipoReserva,
  VeiculoDisponivel,
} from '../types';

function limpar(filtros: FiltrosReservas) {
  return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
}

async function historico(alvo: 'veiculos' | 'condutores', id: string, pagina: number, porPagina: number) {
  const { data, meta } = await apiService.getPaginado<Omit<HistoricoUtilizacao, 'meta'>>(
    `/${alvo}/${id}/historico`, { pagina, por_pagina: porPagina }
  );
  return { ...data, meta: meta! } as HistoricoUtilizacao;
}

export const reservaService = {
  listar: async (filtros: FiltrosReservas): Promise<Pagina<Reserva>> => {
    const { data, meta } = await apiService.getPaginado<Reserva[]>('/reservas', limpar(filtros));
    return { itens: data, meta: meta ?? { pagina: 1, por_pagina: data.length, total: data.length } };
  },
  resumo: () => apiService.get<ResumoReservas>('/reservas/resumo'),
  detalhe: (id: string) => apiService.get<ReservaDetalhe>(`/reservas/${id}`),
  disponibilidade: (tipo: TipoReserva, fim: string, inicio?: string) =>
    apiService.get<VeiculoDisponivel[]>('/reservas/disponibilidade', { tipo, fim, ...(inicio && { inicio }) }),
  criar: (dados: ReservaInput) => apiService.post<Reserva>('/reservas', dados),
  registrarRetirada: (id: string) => apiService.post<Reserva>(`/reservas/${id}/retirada`, {}),
  cancelar: (id: string, motivo: string) => apiService.post<Reserva>(`/reservas/${id}/cancelamento`, { motivo }),
  /** Sprint 03 */
  registrarDevolucao: (id: string, dados: DevolucaoInput) =>
    apiService.post<ResultadoDevolucao>(`/reservas/${id}/devolucao`, dados),
  historicoVeiculo: (id: string, pagina: number, porPagina = 10) => historico('veiculos', id, pagina, porPagina),
  historicoCondutor: (id: string, pagina: number, porPagina = 10) => historico('condutores', id, pagina, porPagina),
};
