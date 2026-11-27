import { apiService } from './apiService';
import { Condutor, CondutorInput, FiltrosCondutores, ResumoCondutores } from '../types';

/** Remove filtros vazios para não enviá-los à API. */
function limpar(filtros: FiltrosCondutores) {
  return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
}

export const condutorService = {
  listar: (filtros: FiltrosCondutores) => apiService.get<Condutor[]>('/condutores', limpar(filtros)),
  resumo: () => apiService.get<ResumoCondutores>('/condutores/resumo'),
  criar: (dados: CondutorInput) => apiService.post<Condutor>('/condutores', dados),
  atualizar: (id: string, dados: Partial<CondutorInput>) => apiService.put<Condutor>(`/condutores/${id}`, dados),
};
