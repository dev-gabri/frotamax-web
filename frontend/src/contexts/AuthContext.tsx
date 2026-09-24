import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  hasRole: (roles: string[]) => boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('frotamax_token');
        const storedUser = localStorage.getItem('frotamax_user');
        const storedProfile = localStorage.getItem('frotamax_profile');
        
        if (storedToken && storedUser) {
          // Validate token format before using it
          const tokenParts = storedToken.split('.');
          if (tokenParts.length !== 3) {
            console.warn('Invalid token format found, clearing auth data');
            logout();
            return;
          }
          
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
          }
          await verifyToken(storedToken);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await authService.verifyToken(token);
      if (response.success && response.data) {
        setUser(response.data);
        // Get profile would be called here if needed
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      if (response.success && response.data) {
        const { user, profile, token, first_login_required } = response.data;
        const userWithFirstLogin = { ...user, first_login_required };
        setUser(userWithFirstLogin);
        setProfile(profile);
        setToken(token);
        localStorage.setItem('frotamax_token', token);
        localStorage.setItem('frotamax_user', JSON.stringify(userWithFirstLogin));
        if (profile) {
          localStorage.setItem('frotamax_profile', JSON.stringify(profile));
        }
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setProfile(null);
    setToken(null);
    localStorage.removeItem('frotamax_token');
    localStorage.removeItem('frotamax_user');
    localStorage.removeItem('frotamax_profile');
  };

  const updateProfile = (updatedProfile: Partial<UserProfile>) => {
    if (profile) {
      const newProfile = { ...profile, ...updatedProfile };
      setProfile(newProfile);
      localStorage.setItem('frotamax_profile', JSON.stringify(newProfile));
    }
  };

  const hasRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const isAuthenticated = !!user && !!token;

  const value: AuthContextType = {
    user,
    profile,
    token,
    loading,
    login,
    logout,
    updateProfile,
    hasRole,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};