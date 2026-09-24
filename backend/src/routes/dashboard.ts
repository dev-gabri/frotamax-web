import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get dashboard statistics
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    // Get vehicle stats
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('status')
      .eq('is_active', true);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id')
      .eq('is_active', true);

    const { data: reservations } = await supabase
      .from('reservations')
      .select('status')
      .in('status', ['em_andamento', 'aprovada']);

    const { data: pendingApprovals } = await supabase
      .from('reservations')
      .select('id')
      .eq('status', 'pendente');

    const vehicleStats = vehicles?.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const stats = {
      total_vehicles: vehicles?.length || 0,
      available_vehicles: vehicleStats.disponivel || 0,
      vehicles_in_use: vehicleStats.em_uso || 0,
      vehicles_in_maintenance: vehicleStats.manutencao || 0,
      total_drivers: drivers?.length || 0,
      active_reservations: reservations?.length || 0,
      pending_approvals: pendingApprovals?.length || 0,
      documents_expiring_soon: 0 // TODO: Implement actual logic
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;