import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { supabase } from '../services/supabaseClient';
import { AuthRequest, RegisterRequest, AuthResponse } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { authenticateLocalUser, getLocalUserFromToken, isLocalAuthEnabled } from '../services/localAuthService';

const router = Router();

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password }: AuthRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios'
      });
    }

    const localAccount = authenticateLocalUser(email, password);
    if (localAccount) {
      const token = jwt.sign(
        { userId: localAccount.user.id, email: localAccount.user.email, role: 'admin', local: true },
        process.env.JWT_SECRET as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' } as SignOptions
      );

      return res.json({
        success: true,
        data: {
          ...localAccount,
          token,
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          first_login_required: false
        },
        message: 'Login local realizado com sucesso'
      });
    }

    if (isLocalAuthEnabled()) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, role, is_active, account_status, first_login_required, failed_login_attempts, locked_until')
      .eq('email', email.toLowerCase())
      .single();

    if (userError) {
      console.error(`❌ Supabase error:`, userError);
    }

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    if (!user.is_active || user.account_status === 'inactive' || user.account_status === 'suspended') {
      return res.status(401).json({
        success: false,
        error: 'Conta desativada. Entre em contato com o administrador.'
      });
    }

    if (user.account_status === 'pending_activation') {
      return res.status(401).json({
        success: false,
        error: 'Conta aguardando ativação. Entre em contato com o administrador.'
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(423).json({
        success: false,
        error: 'Conta temporariamente bloqueada devido a tentativas de login falhadas. Tente novamente mais tarde.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Increment failed login attempts
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const updateData: any = { failed_login_attempts: newFailedAttempts };
      
      // Lock account after 5 failed attempts for 30 minutes
      if (newFailedAttempts >= 5) {
        updateData.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }
      
      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);
      
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Reset failed login attempts and update last login
    await supabase
      .from('users')
      .update({ 
        failed_login_attempts: 0, 
        locked_until: null,
        last_login_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      profile: profile || null,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    res.json({
      success: true,
      data: {
        ...response,
        first_login_required: user.first_login_required
      },
      message: 'Login realizado com sucesso'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Register endpoint (admin only)
router.post('/register', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, department, cost_center }: RegisterRequest = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email, senha, nome completo e função são obrigatórios'
      });
    }

    const allowedRoles = ['admin', 'gestor_frota', 'rh', 'condutor', 'visualizador'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Função de usuário inválida' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 8 caracteres' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Usuário já existe com este email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        role,
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar usuário'
      });
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        full_name,
        department,
        cost_center
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Note: User was created but profile failed - handle accordingly
    }

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      message: 'Usuário criado com sucesso'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const localUser = getLocalUserFromToken(decoded);
    if (localUser) {
      return res.json({ success: true, data: localUser, message: 'Token válido' });
    }
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou usuário inativo'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'Token válido'
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    }
    
    res.status(401).json({
      success: false,
      error: 'Token inválido'
    });
  }
});

// Enable driver system access endpoint (fleet manager/admin only)
router.post('/enable-driver-access', authMiddleware, requireRole(['admin', 'gestor_frota']), async (req: Request, res: Response) => {
  try {
    const { driver_id, initial_password } = req.body;
    const enabledBy = (req as any).user.id;

    if (!driver_id || !initial_password) {
      return res.status(400).json({
        success: false,
        error: 'ID do condutor e senha inicial são obrigatórios'
      });
    }

    // Get driver information
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, email, full_name, cpf, user_id')
      .eq('id', driver_id)
      .single();

    if (driverError || !driver) {
      return res.status(404).json({
        success: false,
        error: 'Condutor não encontrado'
      });
    }

    if (!driver.email) {
      return res.status(400).json({
        success: false,
        error: 'Condutor deve ter um email cadastrado para acesso ao sistema'
      });
    }

    // Check if user already exists for this email
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', driver.email.toLowerCase())
      .single();

    let userId = driver.user_id;

    if (!existingUser) {
      // Create new user account for driver
      const hashedPassword = await bcrypt.hash(initial_password, 12);
      
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: driver.email.toLowerCase(),
          password_hash: hashedPassword,
          role: 'condutor',
          is_active: true,
          account_status: 'active',
          first_login_required: true
        })
        .select()
        .single();

      if (userError) {
        console.error('User creation error:', userError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao criar conta de usuário'
        });
      }

      userId = newUser.id;

      // Create user profile
      await supabase
        .from('user_profiles')
        .insert({
          user_id: newUser.id,
          full_name: driver.full_name
        });
    } else {
      userId = existingUser.id;
      
      // Update existing user with new password
      const hashedPassword = await bcrypt.hash(initial_password, 12);
      await supabase
        .from('users')
        .update({
          password_hash: hashedPassword,
          first_login_required: true,
          account_status: 'active',
          is_active: true
        })
        .eq('id', existingUser.id);
    }

    // Update driver record with user_id and system access info
    const { error: updateError } = await supabase
      .from('drivers')
      .update({
        user_id: userId,
        system_access_enabled: true,
        system_access_enabled_by: enabledBy,
        system_access_enabled_at: new Date().toISOString()
      })
      .eq('id', driver_id);

    if (updateError) {
      console.error('Driver update error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao ativar acesso ao sistema'
      });
    }

    res.json({
      success: true,
      message: 'Acesso ao sistema habilitado com sucesso',
      data: {
        driver_id,
        email: driver.email,
        initial_password_set: true
      }
    });
  } catch (error) {
    console.error('Enable driver access error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Change password on first login
router.post('/change-first-login-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { new_password } = req.body;
    const userId = (req as any).user.id;

    if (!new_password) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha é obrigatória'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    // Get user to check if first login is required
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('first_login_required')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    if (!user.first_login_required) {
      return res.status(400).json({
        success: false,
        error: 'Troca de senha no primeiro login não é necessária'
      });
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(new_password, 12);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        first_login_required: false
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar senha'
      });
    }

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Change first login password error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Reset password request endpoint
router.post('/reset-password-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email é obrigatório'
      });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    // Always return success to prevent email enumeration
    if (userError || !user) {
      return res.json({
        success: true,
        message: 'Se o email existir no sistema, um link de redefinição será enviado'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Reset token update error:', updateError);
    }

    // TODO: Send the reset link through the configured email provider.

    res.json({
      success: true,
      message: 'Se o email existir no sistema, um link de redefinição será enviado'
    });
  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Reset password with token endpoint
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Token e nova senha são obrigatórios'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    // Find user with valid reset token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (userError || !user) {
      return res.status(400).json({
        success: false,
        error: 'Token de redefinição inválido'
      });
    }

    // Check if token is expired
    if (!user.reset_token_expires || new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({
        success: false,
        error: 'Token de redefinição expirado'
      });
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(new_password, 12);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        failed_login_attempts: 0,
        locked_until: null
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Password reset error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao redefinir senha'
      });
    }

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get drivers without system access (for activation list)
router.get('/drivers-pending-access', authMiddleware, requireRole(['admin', 'gestor_frota']), async (req: Request, res: Response) => {
  try {
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('id, full_name, email, cpf, system_access_enabled, is_active')
      .eq('is_active', true)
      .eq('system_access_enabled', false)
      .not('email', 'is', null);

    if (error) {
      console.error('Get drivers pending access error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar condutores'
      });
    }

    res.json({
      success: true,
      data: drivers || []
    });
  } catch (error) {
    console.error('Get drivers pending access error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
