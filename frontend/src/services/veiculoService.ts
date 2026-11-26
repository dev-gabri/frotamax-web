import { apiService } from './apiService';
import { FiltrosVeiculos, ResumoVeiculos, Situacao, Veiculo, VeiculoInput } from '../types';

/** Remove filtros vazios para não enviá-los à API. */
function limpar(filtros: FiltrosVeiculos) {
  return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
}

export const veiculoService = {
  listar: (filtros: FiltrosVeiculos) => apiService.get<Veiculo[]>('/veiculos', limpar(filtros)),
  resumo: () => apiService.get<ResumoVeiculos>('/veiculos/resumo'),
  criar: (dados: VeiculoInput) => apiService.post<Veiculo>('/veiculos', dados),
  atualizar: (id: string, dados: Partial<VeiculoInput>) => apiService.put<Veiculo>(`/veiculos/${id}`, dados),
  alterarSituacao: (id: string, situacao: Situacao) => apiService.patch<Veiculo>(`/veiculos/${id}/situacao`, { situacao }),
};
