import { apiService } from './apiService';
import {
  FiltrosReservas,
  Reserva,
  ReservaDetalhe,
  ReservaInput,
  ResumoReservas,
  TipoReserva,
  VeiculoDisponivel,
} from '../types';

function limpar(filtros: FiltrosReservas) {
  return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
}

export const reservaService = {
  listar: (filtros: FiltrosReservas) => apiService.get<Reserva[]>('/reservas', limpar(filtros)),
  resumo: () => apiService.get<ResumoReservas>('/reservas/resumo'),
  detalhe: (id: string) => apiService.get<ReservaDetalhe>(`/reservas/${id}`),
  disponibilidade: (tipo: TipoReserva, fim: string, inicio?: string) =>
    apiService.get<VeiculoDisponivel[]>('/reservas/disponibilidade', { tipo, fim, ...(inicio && { inicio }) }),
  criar: (dados: ReservaInput) => apiService.post<Reserva>('/reservas', dados),
  registrarRetirada: (id: string) => apiService.post<Reserva>(`/reservas/${id}/retirada`, {}),
  cancelar: (id: string, motivo: string) => apiService.post<Reserva>(`/reservas/${id}/cancelamento`, { motivo }),
};
