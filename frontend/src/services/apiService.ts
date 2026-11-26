import axios, { AxiosError, AxiosInstance } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const TOKEN_KEY = 'frotamax_token';

/** Erro com mensagem já pronta para exibição ao usuário. */
export class ApiError extends Error {
  constructor(message: string, public status?: number, public details?: string[]) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Cliente HTTP único da aplicação.
 * Inclui o token nas requisições e converte erros da API em mensagens compreensíveis.
 */
class ApiService {
  private client: AxiosInstance;
  private onUnauthorized?: () => void;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /** Função chamada quando a API responder 401 (sessão expirada ou inválida). */
  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
  }

  private toApiError(error: unknown): ApiError {
    const err = error as AxiosError<ApiResponse<unknown>>;
    if (err.response) {
      const status = err.response.status;
      if (status === 401 && !err.config?.url?.includes('/auth/login')) this.onUnauthorized?.();
      const body = err.response.data;
      return new ApiError(body?.error || 'Não foi possível concluir a operação.', status, body?.details);
    }
    return new ApiError('Não foi possível conectar ao servidor. Verifique se a API está em execução.');
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const { data } = await this.client.get<ApiResponse<T>>(url, { params });
      return data.data as T;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  async post<T>(url: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.client.post<ApiResponse<T>>(url, body);
      return data.data as T;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  async put<T>(url: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.client.put<ApiResponse<T>>(url, body);
      return data.data as T;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  async patch<T>(url: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.client.patch<ApiResponse<T>>(url, body);
      return data.data as T;
    } catch (error) {
      throw this.toApiError(error);
    }
  }
}

export const apiService = new ApiService();
