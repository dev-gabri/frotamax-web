import { apiService } from './apiService';
import { Employee, ApiResponse } from '../types';

export interface EmployeeFilters {
  cpf?: string;
  name_query?: string;
  status?: 'active' | 'inactive';
  termination_after?: string;
  page?: number;
  limit?: number;
  order_by?: string;
  order?: 'ASC' | 'DESC';
}

export interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class EmployeeService {
  async getEmployees(filters: EmployeeFilters = {}): Promise<EmployeeListResponse> {
    const params = new URLSearchParams();
    
    if (filters.cpf) params.append('cpf', filters.cpf);
    if (filters.name_query) params.append('name_query', filters.name_query);
    if (filters.status) params.append('status', filters.status);
    if (filters.termination_after) params.append('termination_after', filters.termination_after);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.order_by) params.append('order_by', filters.order_by);
    if (filters.order) params.append('order', filters.order);

    const queryString = params.toString();
    const endpoint = queryString ? `/employees?${queryString}` : '/employees';
    
    const response = await apiService.get<any>(endpoint);
    return response as EmployeeListResponse;
  }

  async getEmployee(id: string): Promise<ApiResponse<Employee>> {
    return await apiService.get<Employee>(`/employees/${id}`);
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Employee>> {
    return await apiService.post<Employee>('/employees', employee);
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<ApiResponse<Employee>> {
    return await apiService.put<Employee>(`/employees/${id}`, employee);
  }

  async deleteEmployee(id: string): Promise<ApiResponse<void>> {
    return await apiService.delete<void>(`/employees/${id}`);
  }

  async searchEmployees(query: string): Promise<ApiResponse<Employee[]>> {
    return await apiService.get<Employee[]>(`/employees/search?q=${encodeURIComponent(query)}`);
  }

  async searchEmployeesForDriver(query: string): Promise<ApiResponse<Employee[]>> {
    return await apiService.get<Employee[]>(`/drivers/search-employees?q=${encodeURIComponent(query)}`);
  }
}

export const employeeService = new EmployeeService();