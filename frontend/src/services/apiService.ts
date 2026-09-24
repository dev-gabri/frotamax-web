import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('frotamax_token');
        
        // More thorough token validation
        if (token && 
            token.trim() !== '' && 
            token !== 'null' && 
            token !== 'undefined' && 
            token !== 'false' &&
            token.length > 10) {
          try {
            // Basic validation to check if it looks like a JWT token
            const parts = token.split('.');
            if (parts.length === 3 && parts.every(part => part.length > 0)) {
              // Additional check: ensure it's not just periods
              if (!token.match(/^\.+$/)) {
                config.headers.Authorization = `Bearer ${token}`;
              } else {
                console.warn('Token contains only periods, removing...');
                this.clearAuthData();
              }
            } else {
              console.warn(`Invalid token format found (${parts.length} parts), removing...`);
              this.clearAuthData();
            }
          } catch (error) {
            console.warn('Error validating token, removing...', error);
            this.clearAuthData();
          }
        } else if (token) {
          console.warn(`Invalid token value found: "${token}", removing...`);
          this.clearAuthData();
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle common errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - only redirect if not already on login page
          localStorage.removeItem('frotamax_token');
          localStorage.removeItem('frotamax_user');
          localStorage.removeItem('frotamax_profile');
          
          if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/first-login')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private clearAuthData() {
    localStorage.removeItem('frotamax_token');
    localStorage.removeItem('frotamax_user');
    localStorage.removeItem('frotamax_profile');
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(endpoint);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async patch<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(endpoint);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async request<T>(endpoint: string, method: string, data?: any): Promise<T> {
    try {
      const response = await this.client.request<T>({
        url: endpoint,
        method: method as any,
        data
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async requestWithFormData<T>(endpoint: string, method: string, formData: FormData): Promise<T> {
    try {
      const response = await this.client.request<T>({
        url: endpoint,
        method: method as any,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }
}

export const apiService = new ApiService();