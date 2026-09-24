import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { authMiddleware } from '../middleware/auth';
import { VehicleAssignment, AssignmentHistory, AssignmentRequest, AssignmentUpdateRequest, AuthenticatedRequest } from '../types';

const router = Router();

// Test endpoint to check database schema (no auth required for debugging)
router.get('/test-no-auth', async (req, res) => {
  try {
    console.log('Testing database access...');
    
    // Test with service role (bypasses RLS)
    const { supabase: supabaseService } = await import('../services/supabaseClient');
    
    const tablesTest = await Promise.all([
      supabaseService.from('vehicle_assignments').select('count', { count: 'exact', head: true }),
      supabaseService.from('vehicles').select('count', { count: 'exact', head: true }),
      supabaseService.from('drivers').select('count', { count: 'exact', head: true }),
      supabaseService.from('users').select('count', { count: 'exact', head: true })
    ]);

    const results = {
      vehicle_assignments: tablesTest[0].error ? tablesTest[0].error.message : `OK (${tablesTest[0].count || 0})`,
      vehicles: tablesTest[1].error ? tablesTest[1].error.message : `OK (${tablesTest[1].count || 0})`,
      drivers: tablesTest[2].error ? tablesTest[2].error.message : `OK (${tablesTest[2].count || 0})`,
      users: tablesTest[3].error ? tablesTest[3].error.message : `OK (${tablesTest[3].count || 0})`
    };

    console.log('Database test results:', results);

    res.json({ 
      message: 'Database schema test (service role)',
      schema: 'log_frotamax',
      tables: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: 'Database test failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// Apply auth middleware to all routes below this point
router.use(authMiddleware);

// Test endpoint to check database schema (with auth)
router.get('/test', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('Testing database access with auth...', { userId: req.user?.id, userRole: req.user?.role });
    
    // Test basic table access
    const tablesTest = await Promise.all([
      supabase.from('vehicle_assignments').select('count', { count: 'exact', head: true }),
      supabase.from('vehicles').select('count', { count: 'exact', head: true }),
      supabase.from('drivers').select('count', { count: 'exact', head: true }),
      supabase.from('users').select('count', { count: 'exact', head: true })
    ]);

    const results = {
      vehicle_assignments: tablesTest[0].error ? tablesTest[0].error.message : `OK (${tablesTest[0].count || 0})`,
      vehicles: tablesTest[1].error ? tablesTest[1].error.message : `OK (${tablesTest[1].count || 0})`,
      drivers: tablesTest[2].error ? tablesTest[2].error.message : `OK (${tablesTest[2].count || 0})`,
      users: tablesTest[3].error ? tablesTest[3].error.message : `OK (${tablesTest[3].count || 0})`
    };

    console.log('Database test results:', results);

    res.json({ 
      message: 'Database schema test',
      schema: 'log_frotamax',
      tables: results,
      user: { id: req.user?.id, role: req.user?.role },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: 'Database test failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// Get all assignments with filtering and pagination
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('Assignments endpoint accessed by user:', { userId: req.user?.id, role: req.user?.role });
    
    const { 
      page = 1, 
      limit = 20, 
      vehicle_id, 
      driver_id, 
      assignment_type, 
      status,
      include_terminated = false
    } = req.query;

    console.log('Raw query params:', req.query);

    // Validate and sanitize parameters
    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 20));
    const offset = (pageNum - 1) * limitNum;

    console.log('Parsed params:', { pageNum, limitNum, offset, vehicle_id, driver_id, assignment_type, status, include_terminated });
    
    // Try a simple query first without joins to test basic access
    const simpleQuery = await supabase
      .from('vehicle_assignments')
      .select('*')
      .limit(1);
    
    if (simpleQuery.error) {
      console.error('Simple query error:', simpleQuery.error);
      // For now, return empty data instead of failing
      return res.json({
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          pages: 0
        },
        debug: {
          message: 'RLS issue detected, returning empty results',
          error: simpleQuery.error.message,
          userRole: req.user?.role
        }
      });
    }
    
    // Query with related data (vehicles and drivers)
    let query = supabase
      .from('vehicle_assignments')
      .select(`
        *,
        vehicle:vehicles!vehicle_assignments_vehicle_id_fkey(license_plate, brand, model, status),
        driver:drivers!vehicle_assignments_driver_id_fkey(full_name, cpf, email),
        assigned_by_user:users!assigned_by(email)
      `)
      .order('created_at', { ascending: false });
    
    console.log('Executing query with filters:', { vehicle_id, driver_id, assignment_type, status, include_terminated });

    // Apply filters
    if (vehicle_id) {
      query = query.eq('vehicle_id', vehicle_id);
    }
    
    if (driver_id) {
      query = query.eq('driver_id', driver_id);
    }
    
    if (assignment_type) {
      query = query.eq('assignment_type', assignment_type);
    }
    
    if (status) {
      query = query.eq('status', status);
    } else if (!include_terminated) {
      query = query.in('status', ['active', 'inactive']);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    console.log('About to execute query...');
    const { data, error, count } = await query;
    console.log('Query executed. Error:', error, 'Data count:', data?.length, 'Total count:', count);

    if (error) {
      console.error('Query error details:', error);
      return res.status(500).json({ 
        error: error.message,
        details: error,
        query_info: { vehicle_id, driver_id, assignment_type, status, include_terminated }
      });
    }

    const totalPages = Math.ceil((count || 0) / limitNum);

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: totalPages
      },
      debug: {
        user: { id: req.user?.id, role: req.user?.role },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assignment by ID
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(`
        *,
        vehicle:vehicles!vehicle_assignments_vehicle_id_fkey(license_plate, brand, model, status),
        driver:drivers!vehicle_assignments_driver_id_fkey(full_name, cpf, email),
        assigned_by_user:users!assigned_by(email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new assignment
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('POST /assignments - Creating assignment with body:', req.body);
    console.log('POST /assignments - User:', { id: req.user?.id, role: req.user?.role });
    
    const { vehicle_id, driver_id, assignment_type, start_date, end_date, notes }: AssignmentRequest = req.body;
    const assigned_by = req.user?.id;

    if (!assigned_by) {
      console.log('POST /assignments - Error: User not authenticated');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate required fields
    if (!vehicle_id || !driver_id || !assignment_type || !start_date) {
      console.log('POST /assignments - Error: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user has permission (only admin and gestor_frota can create assignments)
    if (!['admin', 'gestor_frota'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Validate assignment type and dates
    if (assignment_type === 'permanent' && end_date) {
      return res.status(400).json({ error: 'Permanent assignments cannot have end dates' });
    }
    
    if (assignment_type === 'temporary' && !end_date) {
      return res.status(400).json({ error: 'Temporary assignments must have end dates' });
    }

    // Check if vehicle exists and is active
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, status, is_permanently_assigned')
      .eq('id', vehicle_id)
      .eq('is_active', true)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehicle not found or inactive' });
    }

    // Check if driver exists and is active
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', driver_id)
      .eq('is_active', true)
      .single();

    if (driverError || !driver) {
      return res.status(404).json({ error: 'Driver not found or inactive' });
    }

    // Check for conflicting assignments
    if (assignment_type === 'permanent') {
      console.log('POST /assignments - Checking for existing permanent assignment for vehicle:', vehicle_id);
      
      // Check if vehicle already has a permanent assignment
      const { data: existingAssignment, error: assignmentError } = await supabase
        .from('vehicle_assignments')
        .select('id')
        .eq('vehicle_id', vehicle_id)
        .eq('assignment_type', 'permanent')
        .eq('status', 'active')
        .single();

      console.log('POST /assignments - Existing assignment check result:', { existingAssignment, assignmentError });

      if (existingAssignment) {
        console.log('POST /assignments - Error: Vehicle already has permanent assignment');
        return res.status(409).json({ error: 'Vehicle already has a permanent assignment' });
      }
    }

    // Create the assignment
    console.log('POST /assignments - Creating assignment with data:', {
      vehicle_id,
      driver_id,
      assigned_by,
      assignment_type,
      start_date,
      end_date: assignment_type === 'temporary' ? end_date : null,
      notes,
      status: 'active'
    });
    
    const { data: assignment, error } = await supabase
      .from('vehicle_assignments')
      .insert({
        vehicle_id,
        driver_id,
        assigned_by,
        assignment_type,
        start_date,
        end_date: assignment_type === 'temporary' ? end_date : null,
        notes,
        status: 'active'
      })
      .select(`
        *,
        vehicle:vehicles!vehicle_assignments_vehicle_id_fkey(license_plate, brand, model, status),
        driver:drivers!vehicle_assignments_driver_id_fkey(full_name, cpf, email),
        assigned_by_user:users!assigned_by(email)
      `)
      .single();

    console.log('POST /assignments - Insert result:', { assignment, error });

    if (error) {
      console.log('POST /assignments - Error creating assignment:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('POST /assignments - Assignment created successfully:', assignment);
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update assignment
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { assignment_type, start_date, end_date, status, notes, change_reason }: AssignmentUpdateRequest = req.body;
    const changed_by = req.user?.id;

    if (!changed_by) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission
    if (!['admin', 'gestor_frota'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get current assignment
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('vehicle_assignments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Build update object
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (assignment_type) updateData.assignment_type = assignment_type;
    if (start_date) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    // Validate assignment type and dates
    const finalType = assignment_type || currentAssignment.assignment_type;
    const finalEndDate = end_date !== undefined ? end_date : currentAssignment.end_date;

    if (finalType === 'permanent' && finalEndDate) {
      return res.status(400).json({ error: 'Permanent assignments cannot have end dates' });
    }
    
    if (finalType === 'temporary' && !finalEndDate) {
      return res.status(400).json({ error: 'Temporary assignments must have end dates' });
    }

    // Update assignment
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('vehicle_assignments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        vehicle:vehicles!vehicle_assignments_vehicle_id_fkey(license_plate, brand, model, status),
        driver:drivers!vehicle_assignments_driver_id_fkey(full_name, cpf, email),
        assigned_by_user:users!assigned_by(email)
      `)
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Terminate assignment
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission
    if (!['admin', 'gestor_frota'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get current assignment
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('vehicle_assignments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Terminate assignment
    const { error: terminateError } = await supabase
      .from('vehicle_assignments')
      .update({ status: 'terminated', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (terminateError) {
      return res.status(500).json({ error: terminateError.message });
    }

    // Log termination reason if provided
    if (reason) {
      await supabase
        .from('assignment_history')
        .insert({
          assignment_id: id,
          action: 'terminated',
          changed_by: req.user.id,
          change_reason: reason
        });
    }

    res.json({ message: 'Assignment terminated successfully' });
  } catch (error) {
    console.error('Error terminating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assignment history
router.get('/:id/history', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('assignment_history')
      .select(`
        *,
        changed_by_user:users!changed_by(email)
      `)
      .eq('assignment_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching assignment history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assignments for a specific driver
router.get('/driver/:driverId', async (req: AuthenticatedRequest, res) => {
  try {
    const { driverId } = req.params;
    const { include_terminated = false } = req.query;

    let query = supabase
      .from('vehicle_assignments')
      .select(`
        *,
        vehicle:vehicles!vehicle_assignments_vehicle_id_fkey(license_plate, brand, model, status),
        assigned_by_user:users!assigned_by(email)
      `)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (!include_terminated) {
      query = query.in('status', ['active', 'inactive']);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching driver assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assignments for a specific vehicle
router.get('/vehicle/:vehicleId', async (req: AuthenticatedRequest, res) => {
  try {
    const { vehicleId } = req.params;
    const { include_terminated = false } = req.query;

    let query = supabase
      .from('vehicle_assignments')
      .select(`
        *,
        driver:drivers!vehicle_assignments_driver_id_fkey(full_name, cpf, email),
        assigned_by_user:users!assigned_by(email)
      `)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });

    if (!include_terminated) {
      query = query.in('status', ['active', 'inactive']);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching vehicle assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;