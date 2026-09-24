import { VehicleAssignment, AssignmentRequest, AssignmentUpdateRequest, AssignmentHistory } from '../types';
import { apiService } from './apiService';

export class AssignmentService {
  /**
   * Get all assignments with optional filters
   */
  static async getAssignments(params?: {
    page?: number;
    limit?: number;
    vehicle_id?: string;
    driver_id?: string;
    assignment_type?: string;
    status?: string;
    include_terminated?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const response = await apiService.get(`/assignments?${queryParams}`);
    return response.data;
  }

  /**
   * Get assignment by ID
   */
  static async getAssignment(id: string): Promise<VehicleAssignment> {
    const response = await apiService.get(`/assignments/${id}`);
    return response.data as VehicleAssignment;
  }

  /**
   * Create new assignment
   */
  static async createAssignment(assignmentData: AssignmentRequest): Promise<VehicleAssignment> {
    const response = await apiService.post('/assignments', assignmentData);
    return response.data as VehicleAssignment;
  }

  /**
   * Update assignment
   */
  static async updateAssignment(id: string, updateData: AssignmentUpdateRequest): Promise<VehicleAssignment> {
    const response = await apiService.put(`/assignments/${id}`, updateData);
    return response.data as VehicleAssignment;
  }

  /**
   * Terminate assignment
   */
  static async terminateAssignment(id: string): Promise<void> {
    await apiService.delete(`/assignments/${id}`);
  }

  /**
   * Get assignment history
   */
  static async getAssignmentHistory(id: string): Promise<AssignmentHistory[]> {
    const response = await apiService.get(`/assignments/${id}/history`);
    return response.data as AssignmentHistory[];
  }

  /**
   * Get assignments for a specific driver
   */
  static async getDriverAssignments(driverId: string, includeTerminated = false): Promise<VehicleAssignment[]> {
    const queryParams = new URLSearchParams();
    if (includeTerminated) {
      queryParams.append('include_terminated', 'true');
    }
    
    const response = await apiService.get(`/assignments/driver/${driverId}?${queryParams}`);
    return response.data as VehicleAssignment[];
  }

  /**
   * Get assignments for a specific vehicle
   */
  static async getVehicleAssignments(vehicleId: string, includeTerminated = false): Promise<VehicleAssignment[]> {
    const queryParams = new URLSearchParams();
    if (includeTerminated) {
      queryParams.append('include_terminated', 'true');
    }
    
    const response = await apiService.get(`/assignments/vehicle/${vehicleId}?${queryParams}`);
    return response.data as VehicleAssignment[];
  }

  /**
   * Check if vehicle is available for assignment
   */
  static async checkVehicleAvailability(vehicleId: string): Promise<{ available: boolean; reason?: string }> {
    try {
      // Get vehicle assignments to check availability
      const assignments = await this.getVehicleAssignments(vehicleId);
      
      // Check for active permanent assignment
      const permanentAssignment = assignments.find(
        a => a.assignment_type === 'permanent' && a.status === 'active'
      );
      
      if (permanentAssignment) {
        return {
          available: false,
          reason: `Vehicle is permanently assigned to ${permanentAssignment.driver?.full_name}`
        };
      }
      
      return { available: true };
    } catch (error) {
      console.error('Error checking vehicle availability:', error);
      return { available: false, reason: 'Error checking availability' };
    }
  }

  /**
   * Check if driver is available for assignment
   */
  static async checkDriverAvailability(driverId: string): Promise<{ available: boolean; reason?: string }> {
    try {
      // Get driver assignments to check availability
      const assignments = await this.getDriverAssignments(driverId);
      
      // Check for active permanent assignment
      const permanentAssignment = assignments.find(
        a => a.assignment_type === 'permanent' && a.status === 'active'
      );
      
      if (permanentAssignment) {
        return {
          available: false,
          reason: `Driver is permanently assigned to vehicle ${permanentAssignment.vehicle?.license_plate}`
        };
      }
      
      return { available: true };
    } catch (error) {
      console.error('Error checking driver availability:', error);
      return { available: false, reason: 'Error checking availability' };
    }
  }

  /**
   * Get assignment statistics
   */
  static async getAssignmentStats() {
    try {
      const assignments = await this.getAssignments({ include_terminated: true });
      const allAssignments = (assignments as any).data || [];
      
      const stats = {
        total_assignments: allAssignments.length,
        active_assignments: allAssignments.filter((a: VehicleAssignment) => a.status === 'active').length,
        permanent_assignments: allAssignments.filter(
          (a: VehicleAssignment) => a.assignment_type === 'permanent' && a.status === 'active'
        ).length,
        temporary_assignments: allAssignments.filter(
          (a: VehicleAssignment) => a.assignment_type === 'temporary' && a.status === 'active'
        ).length,
        terminated_assignments: allAssignments.filter((a: VehicleAssignment) => a.status === 'terminated').length,
        unique_assigned_drivers: new Set(
          allAssignments
            .filter((a: VehicleAssignment) => a.status === 'active')
            .map((a: VehicleAssignment) => a.driver_id)
        ).size,
        unique_assigned_vehicles: new Set(
          allAssignments
            .filter((a: VehicleAssignment) => a.status === 'active')
            .map((a: VehicleAssignment) => a.vehicle_id)
        ).size
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting assignment stats:', error);
      return {
        total_assignments: 0,
        active_assignments: 0,
        permanent_assignments: 0,
        temporary_assignments: 0,
        terminated_assignments: 0,
        unique_assigned_drivers: 0,
        unique_assigned_vehicles: 0
      };
    }
  }

  /**
   * Format assignment for display
   */
  static formatAssignmentType(type: string): string {
    return type === 'permanent' ? 'Permanent' : 'Temporary';
  }

  /**
   * Format assignment status for display
   */
  static formatAssignmentStatus(status: string): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'terminated':
        return 'Terminated';
      default:
        return status;
    }
  }

  /**
   * Check if assignment is expired
   */
  static isAssignmentExpired(assignment: VehicleAssignment): boolean {
    if (assignment.assignment_type === 'permanent') return false;
    if (!assignment.end_date) return false;
    return new Date(assignment.end_date) < new Date();
  }

  /**
   * Get assignment duration in days
   */
  static getAssignmentDuration(assignment: VehicleAssignment): number | null {
    if (assignment.assignment_type === 'permanent') return null;
    if (!assignment.end_date) return null;
    
    const start = new Date(assignment.start_date);
    const end = new Date(assignment.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export default AssignmentService;