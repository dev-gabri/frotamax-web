import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest, ReservationRequest } from '../types';
import { requireFleetManager, requireDriverOrManager } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get all reservations
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let query = supabase
      .from('reservations')
      .select(`
        *,
        drivers(full_name, cpf),
        vehicles(license_plate, brand, model, status),
        requester:users!reservations_requester_id_fkey(email),
        approver:users!reservations_approver_id_fkey(email)
      `)
      .order('created_at', { ascending: false });

    // Filter based on user role
    if (userRole === 'condutor') {
      query = query.eq('requester_id', userId);
    }

    const { data: reservations, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar reservas'
      });
    }

    res.json({
      success: true,
      data: reservations
    });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Create new reservation
router.post('/', requireDriverOrManager, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const reservationData: ReservationRequest = req.body;

    // Validate required fields
    if (!reservationData.driver_id || !reservationData.vehicle_id || !reservationData.start_date || !reservationData.end_date) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios: condutor, veículo, data início e data fim'
      });
    }

    // Check vehicle availability
    const { data: conflictingReservations, error: conflictError } = await supabase
      .from('reservations')
      .select('id')
      .eq('vehicle_id', reservationData.vehicle_id)
      .in('status', ['aprovada', 'em_andamento'])
      .or(`start_date.lte.${reservationData.end_date},end_date.gte.${reservationData.start_date}`);

    if (conflictError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar disponibilidade do veículo'
      });
    }

    if (conflictingReservations && conflictingReservations.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Veículo não está disponível no período solicitado'
      });
    }

    // Create reservation
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        ...reservationData,
        requester_id: userId,
        status: 'pendente'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar reserva'
      });
    }

    res.status(201).json({
      success: true,
      data: reservation,
      message: 'Reserva criada com sucesso'
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Approve/reject reservation
router.patch('/:id/approve', requireFleetManager, async (req: AuthenticatedRequest, res) => {
  try {
    const reservationId = req.params.id;
    const { action, notes } = req.body; // action: 'approve' or 'reject'
    const userId = req.user?.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Ação deve ser "approve" ou "reject"'
      });
    }

    const status = action === 'approve' ? 'aprovada' : 'rejeitada';

    const { data: reservation, error } = await supabase
      .from('reservations')
      .update({
        status,
        approver_id: userId,
        approval_date: new Date().toISOString(),
        approval_notes: notes
      })
      .eq('id', reservationId)
      .eq('status', 'pendente')
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar reserva'
      });
    }

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada ou já processada'
      });
    }

    // Update vehicle status if approved
    if (action === 'approve') {
      await supabase
        .from('vehicles')
        .update({ status: 'em_uso' })
        .eq('id', reservation.vehicle_id);
    }

    res.json({
      success: true,
      data: reservation,
      message: `Reserva ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso`
    });
  } catch (error) {
    console.error('Approve reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Start reservation (check-out)
router.patch('/:id/checkout', requireDriverOrManager, async (req: AuthenticatedRequest, res) => {
  try {
    const reservationId = req.params.id;
    const { checkout_km, fuel_level_checkout, checkout_condition, checkout_photos } = req.body;

    const { data: reservation, error } = await supabase
      .from('reservations')
      .update({
        status: 'em_andamento',
        checkout_km,
        fuel_level_checkout,
        checkout_condition,
        checkout_photos
      })
      .eq('id', reservationId)
      .eq('status', 'aprovada')
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao iniciar reserva'
      });
    }

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada ou não aprovada'
      });
    }

    res.json({
      success: true,
      data: reservation,
      message: 'Check-out realizado com sucesso'
    });
  } catch (error) {
    console.error('Checkout reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// End reservation (check-in)
router.patch('/:id/checkin', requireDriverOrManager, async (req: AuthenticatedRequest, res) => {
  try {
    const reservationId = req.params.id;
    const { checkin_km, fuel_level_checkin, checkin_condition, checkin_photos } = req.body;

    const { data: reservation, error } = await supabase
      .from('reservations')
      .update({
        status: 'finalizada',
        checkin_km,
        fuel_level_checkin,
        checkin_condition,
        checkin_photos
      })
      .eq('id', reservationId)
      .eq('status', 'em_andamento')
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao finalizar reserva'
      });
    }

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada ou não está em andamento'
      });
    }

    // Update vehicle status back to available
    await supabase
      .from('vehicles')
      .update({ status: 'disponivel' })
      .eq('id', reservation.vehicle_id);

    res.json({
      success: true,
      data: reservation,
      message: 'Check-in realizado com sucesso'
    });
  } catch (error) {
    console.error('Checkin reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Cancel reservation
router.patch('/:id/cancel', async (req: AuthenticatedRequest, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let query = supabase
      .from('reservations')
      .update({ status: 'cancelada' })
      .eq('id', reservationId)
      .in('status', ['pendente', 'aprovada']);

    // Only allow cancellation by requester or fleet manager
    if (userRole !== 'admin' && userRole !== 'gestor_frota') {
      query = query.eq('requester_id', userId);
    }

    const { data: reservation, error } = await query.select().single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao cancelar reserva'
      });
    }

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva não encontrada ou não pode ser cancelada'
      });
    }

    // Update vehicle status back to available if it was approved
    if (reservation.status === 'aprovada') {
      await supabase
        .from('vehicles')
        .update({ status: 'disponivel' })
        .eq('id', reservation.vehicle_id);
    }

    res.json({
      success: true,
      data: reservation,
      message: 'Reserva cancelada com sucesso'
    });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;