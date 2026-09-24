import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get all employees using RPC function
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      cpf,
      name_query,
      status,
      termination_after,
      page = '1',
      limit = '20',
      order_by = 'full_name',
      order = 'ASC'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const { data: employees, error } = await supabase
      .schema('public')
      .rpc('get_employees', {
        p_cpf: cpf || null,
        p_name_query: name_query || null,
        p_status: status || null,
        p_termination_after: termination_after || null,
        p_limit: limitNum,
        p_offset: offset,
        p_order_by: order_by || 'full_name',
        p_order: order || 'ASC'
      });

    if (error) {
      console.error('Get employees RPC error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar colaboradores'
      });
    }

    // Get total count for pagination
    const { data: totalData, error: countError } = await supabase
      .schema('public')
      .rpc('get_employees', {
        p_cpf: cpf || null,
        p_name_query: name_query || null,
        p_status: status || null,
        p_termination_after: termination_after || null,
        p_limit: null,
        p_offset: null,
        p_order_by: order_by || 'full_name',
        p_order: order || 'ASC'
      });

    const total = totalData?.length || 0;
    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: employees || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;