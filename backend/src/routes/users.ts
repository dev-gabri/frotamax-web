import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';
import { uploadAvatar, processAvatar, cleanupOldAvatar } from '../middleware/upload';
import { authMiddleware, requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import Joi from 'joi';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get all users (admin only)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id, email, role, is_active, account_status, created_at, updated_at,
        user_profiles!user_profiles_user_id_fkey(
          full_name, department, cost_center
        )
      `);

    if (error) {
      console.error('Supabase users query error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar usuários',
        details: error.message
      });
    }

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get current user profile
router.get('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar perfil do usuário'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Update user profile
router.put('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { full_name, phone, department, cost_center } = req.body;

    // Validation schema
    const schema = Joi.object({
      full_name: Joi.string().min(2).max(100).required(),
      phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional().allow(''),
      department: Joi.string().max(100).optional().allow(''),
      cost_center: Joi.string().max(50).optional().allow('')
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        full_name,
        phone: phone || null,
        department: department || null,
        cost_center: cost_center || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update profile error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar perfil'
      });
    }

    res.json({
      success: true,
      data: profile,
      message: 'Perfil atualizado com sucesso'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Upload avatar
router.post('/profile/avatar', uploadAvatar.single('avatar'), processAvatar, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    
    if (!req.processedFile) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada'
      });
    }

    // Get current profile to cleanup old avatar
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .eq('user_id', userId)
      .single();

    // Update avatar URL in database
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        avatar_url: req.processedFile.url,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update avatar error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar avatar'
      });
    }

    // Cleanup old avatar file
    if (currentProfile?.avatar_url) {
      cleanupOldAvatar(currentProfile.avatar_url);
    }

    res.json({
      success: true,
      data: {
        avatar_url: req.processedFile.url
      },
      message: 'Avatar atualizado com sucesso'
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Change password
router.patch('/change-password', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { current_password, new_password } = req.body;

    // Validation schema
    const schema = Joi.object({
      current_password: Joi.string().required(),
      new_password: Joi.string().min(6).max(100).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Get current user with password
    const { data: user, error: getUserError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (getUserError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual incorreta'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Update password error:', updateError);
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
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;