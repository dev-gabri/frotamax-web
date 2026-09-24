import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get basic reports data
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      success: true,
      data: {
        message: 'Relatórios em desenvolvimento'
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;