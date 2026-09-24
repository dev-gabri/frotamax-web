import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get user notifications
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar notificações'
      });
    }

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;