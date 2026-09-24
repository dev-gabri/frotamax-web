import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';
import Joi from 'joi';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get user settings
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('theme_mode, theme_primary_color, theme_background_color')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Get settings error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar configurações'
      });
    }

    // Return default settings if not found
    const settings = {
      theme_mode: profile?.theme_mode || 'light',
      theme_primary_color: profile?.theme_primary_color || '#1976d2',
      theme_background_color: profile?.theme_background_color || '#f5f5f5'
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Update user settings
router.put('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { theme_mode, theme_primary_color, theme_background_color } = req.body;

    // Validation schema
    const schema = Joi.object({
      theme_mode: Joi.string().valid('light', 'dark').required(),
      theme_primary_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required(),
      theme_background_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Update settings in user_profiles
    const { data: profile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        theme_mode,
        theme_primary_color,
        theme_background_color,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('theme_mode, theme_primary_color, theme_background_color')
      .single();

    if (updateError) {
      console.error('Update settings error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar configurações'
      });
    }

    res.json({
      success: true,
      data: profile,
      message: 'Configurações atualizadas com sucesso'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;