import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';
import { getLocalUserFromToken } from '../services/localAuthService';

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de acesso requerido' 
      });
    }

    // Check if the header starts with "Bearer "
    if (!authHeader.startsWith('Bearer ')) {
      console.log(`Invalid auth header format: ${authHeader.substring(0, 20)}...`);
      return res.status(401).json({ 
        success: false, 
        error: 'Formato de token inválido. Use: Bearer <token>' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token || 
        token.trim() === '' || 
        token === 'null' || 
        token === 'undefined' || 
        token === 'false' ||
        token.length < 10) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de acesso inválido' 
      });
    }

    const tokenParts = token.split('.');
    
    // Validate JWT format before attempting to verify
    if (tokenParts.length !== 3 || tokenParts.some(part => part.length === 0)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Formato de token inválido' 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido ou expirado' 
      });
    }

    const localUser = getLocalUserFromToken(decoded);
    if (localUser) {
      req.user = localUser;
      return next();
    }
    
    // Verify user exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, is_active, account_status')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      });
    }

    if (!user.is_active || user.account_status === 'inactive' || user.account_status === 'suspended') {
      return res.status(401).json({ 
        success: false, 
        error: 'Conta desativada ou suspensa' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Acesso negado. Permissões insuficientes.' 
      });
    }
    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireFleetManager = requireRole(['admin', 'gestor_frota']);
export const requireHR = requireRole(['admin', 'rh']);
export const requireDriverOrManager = requireRole(['admin', 'gestor_frota', 'condutor']);
