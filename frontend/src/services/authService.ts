import { apiService } from './apiService';
import { User } from '../types';

export interface LoginResult {
  token: string;
  usuario: User;
}

export const authService = {
  login(email: string, senha: string) {
    return apiService.post<LoginResult>('/auth/login', { email, senha });
  },
  me() {
    return apiService.get<User>('/auth/me');
  },
};
