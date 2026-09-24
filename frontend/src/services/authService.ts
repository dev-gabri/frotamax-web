import axios from 'axios';
import { AuthResponse, ApiResponse, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class AuthService {
  private apiClient;

  constructor() {
    this.apiClient = axios.create({
      baseURL: `${API_BASE_URL}/api/auth`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await this.apiClient.post<ApiResponse<AuthResponse>>('/login', {
        email,
        password,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async verifyToken(token: string): Promise<ApiResponse<User>> {
    try {
      const response = await this.apiClient.get<ApiResponse<User>>('/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro ao verificar token');
    }
  }

  async register(userData: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    department?: string;
    cost_center?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.apiClient.post<ApiResponse<any>>('/register', userData);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      throw new Error('Erro ao registrar usuário');
    }
  }
}

export const authService = new AuthService();