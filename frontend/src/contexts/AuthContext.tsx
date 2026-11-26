import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { authService } from '../services/authService';
import { apiService, TOKEN_KEY } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Mantém a sessão do usuário.
 * O token fica no sessionStorage (encerrado ao fechar o navegador) e é sempre
 * revalidado na API (/auth/me) ao abrir a aplicação. As permissões exibidas na
 * interface apenas refletem o que o back-end autoriza.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    apiService.setUnauthorizedHandler(logout);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email: string, senha: string) => {
    const result = await authService.login(email, senha);
    sessionStorage.setItem(TOKEN_KEY, result.token);
    setUser(result.usuario);
  };

  const hasRole = (roles: UserRole[]) => (user ? roles.includes(user.perfil) : false);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
