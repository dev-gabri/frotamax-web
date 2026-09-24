import { supabase } from './supabaseClient';
import { VehicleAssignment, AssignmentRequest, AssignmentUpdateRequest } from '../types';

export class AssignmentService {
  /**
   * Validate assignment request
   */
  static validateAssignmentRequest(request: AssignmentRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!request.vehicle_id) errors.push('Vehicle ID is required');
    if (!request.driver_id) errors.push('Driver ID is required');
    if (!request.assignment_type) errors.push('Assignment type is required');
    if (!request.start_date) errors.push('Start date is required');

    // Assignment type validation
    if (request.assignment_type && !['permanent', 'temporary'].includes(request.assignment_type)) {
      errors.push('Assignment type must be "permanent" or "temporary"');
    }

    // Date validation
    if (request.start_date) {
      const startDate = new Date(request.start_date);
      if (isNaN(startDate.getTime())) {
        errors.push('Start date must be a valid date');
      }
    }

    // End date validation for temporary assignments
    if (request.assignment_type === 'temporary') {
      if (!request.end_date) {
        errors.push('End date is required for temporary assignments');
      } else {
        const endDate = new Date(request.end_date);
        if (isNaN(endDate.getTime())) {
          errors.push('End date must be a valid date');
        } else if (request.start_date && endDate <= new Date(request.start_date)) {
          errors.push('End date must be after start date');
        }
      }
    }

    // Permanent assignments should not have end dates
    if (request.assignment_type === 'permanent' && request.end_date) {
      errors.push('Permanent assignments cannot have end dates');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Check if vehicle is available for assignment
   */
  static async checkVehicleAvailability(vehicleId: string): Promise<{ available: boolean; reason?: string }> {
    try {
      // Check if vehicle exists and is active
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, status, is_permanently_assigned, current_assignment_id')
        .eq('id', vehicleId)
        .eq('is_active', true)
        .single();

      if (vehicleError || !vehicle) {
        return { available: false, reason: 'Vehicle not found or inactive' };
      }

      // Check if vehicle is in maintenance or unavailable
      if (vehicle.status === 'manutencao' || vehicle.status === 'indisponivel') {
        return { available: false, reason: `Vehicle is currently ${vehicle.status}` };
      }

      // Check if vehicle already has a permanent assignment
      if (vehicle.is_permanently_assigned) {
        return { available: false, reason: 'Vehicle already has a permanent assignment' };
      }

      return { available: true };
    } catch (error) {
      console.error('Error checking vehicle availability:', error);
      return { available: false, reason: 'Error checking vehicle availability' };
    }
  }

  /**
   * Check if driver is available for assignment
   */
  static async checkDriverAvailability(driverId: string): Promise<{ available: boolean; reason?: string }> {
    try {
      // Check if driver exists and is active
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id, is_active, internal_terms_status, cnh_expiry_date')
        .eq('id', driverId)
        .eq('is_active', true)
        .single();

      if (driverError || !driver) {
        return { available: false, reason: 'Driver not found or inactive' };
      }

      // Check if driver's CNH is expired
      const cnhExpiryDate = new Date(driver.cnh_expiry_date);
      if (cnhExpiryDate < new Date()) {
        return { available: false, reason: 'Driver\'s CNH is expired' };
      }

      // Check if driver has signed internal terms
      if (driver.internal_terms_status !== 'signed') {
        return { available: false, reason: 'Driver has not signed internal terms' };
      }

      return { available: true };
    } catch (error) {
      console.error('Error checking driver availability:', error);
      return { available: false, reason: 'Error checking driver availability' };
    }
  }

  /**
   * Check for assignment conflicts
   */
  static async checkAssignmentConflicts(
    vehicleId: string,
    driverId: string,
    assignmentType: 'permanent' | 'temporary',
    startDate: string,
    endDate?: string,
    excludeAssignmentId?: string
  ): Promise<{ hasConflict: boolean; conflicts: string[] }> {
    const conflicts: string[] = [];

    try {
      // Check for permanent assignment conflicts
      if (assignmentType === 'permanent') {
        let query = supabase
          .from('vehicle_assignments')
          .select('id')
          .eq('vehicle_id', vehicleId)
          .eq('assignment_type', 'permanent')
          .eq('status', 'active');

        if (excludeAssignmentId) {
          query = query.neq('id', excludeAssignmentId);
        }

        const { data: permanentAssignments, error } = await query;

        if (error) {
          console.error('Error checking permanent assignments:', error);
          conflicts.push('Error checking for permanent assignment conflicts');
        } else if (permanentAssignments && permanentAssignments.length > 0) {
          conflicts.push('Vehicle already has a permanent assignment');
        }
      }

      // Check for overlapping temporary assignments
      if (assignmentType === 'temporary' && endDate) {
        let query = supabase
          .from('vehicle_assignments')
          .select('id, start_date, end_date')
          .eq('vehicle_id', vehicleId)
          .eq('assignment_type', 'temporary')
          .eq('status', 'active')
          .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

        if (excludeAssignmentId) {
          query = query.neq('id', excludeAssignmentId);
        }

        const { data: overlappingAssignments, error } = await query;

        if (error) {
          console.error('Error checking overlapping assignments:', error);
          conflicts.push('Error checking for overlapping assignments');
        } else if (overlappingAssignments && overlappingAssignments.length > 0) {
          conflicts.push('Vehicle has overlapping temporary assignments');
        }
      }

      return { hasConflict: conflicts.length > 0, conflicts };
    } catch (error) {
      console.error('Error checking assignment conflicts:', error);
      return { hasConflict: true, conflicts: ['Error checking assignment conflicts'] };
    }
  }

  /**
   * Get active assignments for a vehicle
   */
  static async getActiveAssignmentsForVehicle(vehicleId: string): Promise<VehicleAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('vehicle_assignments')
        .select(`
          *,
          driver:drivers(full_name, cpf, email),
          assigned_by_user:users!assigned_by(email)
        `)
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active assignments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching active assignments:', error);
      return [];
    }
  }

  /**
   * Get active assignments for a driver
   */
  static async getActiveAssignmentsForDriver(driverId: string): Promise<VehicleAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('vehicle_assignments')
        .select(`
          *,
          vehicle:vehicles(license_plate, brand, model, status),
          assigned_by_user:users!assigned_by(email)
        `)
        .eq('driver_id', driverId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active assignments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching active assignments:', error);
      return [];
    }
  }

  /**
   * Get assignment statistics
   */
  static async getAssignmentStats(): Promise<{
    total_assignments: number;
    active_assignments: number;
    permanent_assignments: number;
    temporary_assignments: number;
    permanently_assigned_vehicles: number;
    assignments_this_month: number;
  }> {
    try {
      const [
        totalResult,
        activeResult,
        permanentResult,
        temporaryResult,
        permanentVehiclesResult,
        thisMonthResult
      ] = await Promise.all([
        supabase.from('vehicle_assignments').select('id', { count: 'exact' }),
        supabase.from('vehicle_assignments').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('vehicle_assignments').select('id', { count: 'exact' }).eq('assignment_type', 'permanent').eq('status', 'active'),
        supabase.from('vehicle_assignments').select('id', { count: 'exact' }).eq('assignment_type', 'temporary').eq('status', 'active'),
        supabase.from('vehicles').select('id', { count: 'exact' }).eq('is_permanently_assigned', true),
        supabase.from('vehicle_assignments').select('id', { count: 'exact' }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ]);

      return {
        total_assignments: totalResult.count || 0,
        active_assignments: activeResult.count || 0,
        permanent_assignments: permanentResult.count || 0,
        temporary_assignments: temporaryResult.count || 0,
        permanently_assigned_vehicles: permanentVehiclesResult.count || 0,
        assignments_this_month: thisMonthResult.count || 0
      };
    } catch (error) {
      console.error('Error fetching assignment stats:', error);
      return {
        total_assignments: 0,
        active_assignments: 0,
        permanent_assignments: 0,
        temporary_assignments: 0,
        permanently_assigned_vehicles: 0,
        assignments_this_month: 0
      };
    }
  }

  /**
   * Check if vehicle can be reserved (not permanently assigned)
   */
  static async canVehicleBeReserved(vehicleId: string, startDate: string, endDate: string): Promise<{ canReserve: boolean; reason?: string }> {
    try {
      // Check if vehicle has a permanent assignment
      const { data: permanentAssignment, error: permanentError } = await supabase
        .from('vehicle_assignments')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .eq('assignment_type', 'permanent')
        .eq('status', 'active')
        .single();

      if (permanentError && permanentError.code !== 'PGRST116') {
        return { canReserve: false, reason: 'Error checking vehicle assignment' };
      }

      if (permanentAssignment) {
        return { canReserve: false, reason: 'Vehicle is permanently assigned to a driver' };
      }

      // Check for overlapping temporary assignments
      const { data: overlappingAssignments, error: overlappingError } = await supabase
        .from('vehicle_assignments')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .eq('assignment_type', 'temporary')
        .eq('status', 'active')
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

      if (overlappingError) {
        return { canReserve: false, reason: 'Error checking vehicle availability' };
      }

      if (overlappingAssignments && overlappingAssignments.length > 0) {
        return { canReserve: false, reason: 'Vehicle has conflicting temporary assignments' };
      }

      return { canReserve: true };
    } catch (error) {
      console.error('Error checking vehicle reservation availability:', error);
      return { canReserve: false, reason: 'Error checking vehicle availability' };
    }
  }

  /**
   * Get assignment conflicts for a date range
   */
  static async getAssignmentConflictsForDateRange(
    vehicleId: string,
    startDate: string,
    endDate: string
  ): Promise<VehicleAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('vehicle_assignments')
        .select(`
          *,
          driver:drivers(full_name, cpf, email),
          assigned_by_user:users!assigned_by(email)
        `)
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .or(`start_date.lte.${endDate},end_date.gte.${startDate},assignment_type.eq.permanent`);

      if (error) {
        console.error('Error fetching assignment conflicts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching assignment conflicts:', error);
      return [];
    }
  }
}

export default AssignmentService;