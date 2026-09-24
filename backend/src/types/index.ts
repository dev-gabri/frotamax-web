// User types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'gestor_frota' | 'rh' | 'condutor' | 'visualizador';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  department?: string;
  cost_center?: string;
  manager_id?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Employee types
export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  cpf: string;
  corporate_email: string;
  department: string;
  cost_center: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Driver types
export interface Driver {
  id: string;
  employee_id?: string;
  cpf: string;
  full_name: string;
  email?: string;
  phone?: string;
  cnh_number: string;
  cnh_category: 'A' | 'B' | 'C' | 'D' | 'E' | 'AB' | 'AC' | 'AD' | 'AE';
  cnh_expiry_date: string;
  internal_terms_status: 'pending' | 'signed' | 'expired';
  internal_terms_signed_date?: string;
  internal_terms_expiry_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Assignment types
export interface VehicleAssignment {
  id: string;
  vehicle_id: string;
  driver_id: string;
  assigned_by: string;
  assignment_type: 'permanent' | 'temporary';
  start_date: string;
  end_date?: string;
  status: 'active' | 'inactive' | 'terminated';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  vehicle?: Vehicle;
  driver?: Driver;
  assigned_by_user?: User;
}

export interface AssignmentHistory {
  id: string;
  assignment_id: string;
  action: 'created' | 'modified' | 'terminated';
  changed_by: string;
  old_values?: any;
  new_values?: any;
  change_reason?: string;
  created_at: string;
  // Relations
  assignment?: VehicleAssignment;
  changed_by_user?: User;
}

// Vehicle types
export interface Vehicle {
  id: string;
  license_plate: string;
  chassis_number: string;
  renavam: string;
  internal_code?: string;
  brand: string;
  model: string;
  manufacture_year: number;
  model_year: number;
  category: string;
  fuel_type: 'gasolina' | 'etanol' | 'diesel' | 'flex' | 'gnv' | 'eletrico' | 'hibrido';
  responsible_department: string;
  cost_center: string;
  base_city: string;
  acquisition_value?: number;
  acquisition_date?: string;
  warranty_supplier?: string;
  warranty_period_months?: number;
  warranty_special_conditions?: string;
  warranty_covered_items?: string;
  status: 'disponivel' | 'em_uso' | 'manutencao' | 'indisponivel';
  current_assignment_id?: string;
  is_permanently_assigned: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Reservation types
export interface Reservation {
  id: string;
  driver_id: string;
  vehicle_id: string;
  requester_id: string;
  approver_id?: string;
  start_date: string;
  end_date: string;
  destination: string;
  trip_reason: string;
  passenger_count: number;
  required_vehicle_category?: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'em_andamento' | 'finalizada' | 'cancelada';
  approval_date?: string;
  approval_notes?: string;
  checkout_km?: number;
  checkin_km?: number;
  fuel_level_checkout?: number;
  fuel_level_checkin?: number;
  checkout_condition?: string;
  checkin_condition?: string;
  checkout_photos?: string[];
  checkin_photos?: string[];
  created_at: string;
  updated_at: string;
}

// Document types
export interface Document {
  id: string;
  entity_type: 'driver' | 'vehicle' | 'user';
  entity_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  type: 'document_expiry' | 'maintenance_due' | 'reservation_approved' | 'reservation_rejected' | 'system_alert';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_read: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  scheduled_for?: string;
  sent_at?: string;
  created_at: string;
}

// Request types
export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role: User['role'];
  department?: string;
  cost_center?: string;
}

export interface ReservationRequest {
  driver_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  destination: string;
  trip_reason: string;
  passenger_count: number;
  required_vehicle_category?: string;
}

export interface AssignmentRequest {
  vehicle_id: string;
  driver_id: string;
  assignment_type: 'permanent' | 'temporary';
  start_date: string;
  end_date?: string;
  notes?: string;
}

export interface AssignmentUpdateRequest {
  assignment_type?: 'permanent' | 'temporary';
  start_date?: string;
  end_date?: string;
  status?: 'active' | 'inactive' | 'terminated';
  notes?: string;
  change_reason?: string;
}

// Response types
export interface AuthResponse {
  user: User;
  profile: UserProfile;
  token: string;
  expires_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Dashboard types
export interface DashboardStats {
  total_vehicles: number;
  available_vehicles: number;
  vehicles_in_use: number;
  vehicles_in_maintenance: number;
  total_drivers: number;
  active_reservations: number;
  pending_approvals: number;
  documents_expiring_soon: number;
}

export interface FleetUtilization {
  department: string;
  total_vehicles: number;
  usage_percentage: number;
  avg_km_per_month: number;
  cost_per_km: number;
}

// Custom Express request with user
import { Request } from 'express';
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Error types
export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}