-- FrotaMax Database Schema
-- This file contains the complete database schema for the FrotaMax application

-- =============================================
-- USERS AND AUTHENTICATION TABLES
-- =============================================

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'gestor_frota', 'rh', 'condutor', 'visualizador')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    cost_center VARCHAR(50),
    manager_id UUID REFERENCES users(id),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- EMPLOYEES TABLE
-- =============================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    corporate_email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    cost_center VARCHAR(50) NOT NULL,
    manager_id UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DRIVERS TABLE
-- =============================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    cpf VARCHAR(14) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    cnh_number VARCHAR(50) UNIQUE NOT NULL,
    cnh_category VARCHAR(10) NOT NULL CHECK (cnh_category IN ('A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE')),
    cnh_expiry_date DATE NOT NULL,
    internal_terms_status VARCHAR(20) DEFAULT 'pending' CHECK (internal_terms_status IN ('pending', 'signed', 'expired')),
    internal_terms_signed_date DATE,
    internal_terms_expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- VEHICLES TABLE
-- =============================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate VARCHAR(10) UNIQUE NOT NULL,
    chassis_number VARCHAR(50) UNIQUE NOT NULL,
    renavam VARCHAR(20) UNIQUE NOT NULL,
    internal_code VARCHAR(50) UNIQUE,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    manufacture_year INTEGER NOT NULL,
    model_year INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    fuel_type VARCHAR(30) NOT NULL CHECK (fuel_type IN ('gasolina', 'etanol', 'diesel', 'flex', 'gnv', 'eletrico', 'hibrido')),
    responsible_department VARCHAR(100) NOT NULL,
    cost_center VARCHAR(50) NOT NULL,
    base_city VARCHAR(100) NOT NULL,
    acquisition_value DECIMAL(12,2),
    acquisition_date DATE,
    warranty_supplier VARCHAR(255),
    warranty_period_months INTEGER,
    warranty_special_conditions TEXT,
    warranty_covered_items TEXT,
    status VARCHAR(20) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'indisponivel')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RESERVATIONS AND USAGE TABLE
-- =============================================

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
    requester_id UUID REFERENCES users(id) NOT NULL,
    approver_id UUID REFERENCES users(id),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    destination TEXT NOT NULL,
    trip_reason TEXT NOT NULL,
    passenger_count INTEGER DEFAULT 1,
    required_vehicle_category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'em_andamento', 'finalizada', 'cancelada')),
    approval_date TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    checkout_km INTEGER,
    checkin_km INTEGER,
    fuel_level_checkout INTEGER,
    fuel_level_checkin INTEGER,
    checkout_condition TEXT,
    checkin_condition TEXT,
    checkout_photos TEXT[], -- Array of photo URLs
    checkin_photos TEXT[], -- Array of photo URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DOCUMENTS TABLE
-- =============================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('driver', 'vehicle', 'user')),
    entity_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('document_expiry', 'maintenance_due', 'reservation_approved', 'reservation_rejected', 'system_alert')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    related_entity_type VARCHAR(20),
    related_entity_id UUID,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- AUDIT LOG TABLE
-- =============================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Users and profiles indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Employees indexes
CREATE INDEX idx_employees_cpf ON employees(cpf);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_department ON employees(department);

-- Drivers indexes
CREATE INDEX idx_drivers_cpf ON drivers(cpf);
CREATE INDEX idx_drivers_cnh_number ON drivers(cnh_number);
CREATE INDEX idx_drivers_cnh_expiry_date ON drivers(cnh_expiry_date);
CREATE INDEX idx_drivers_internal_terms_expiry_date ON drivers(internal_terms_expiry_date);

-- Vehicles indexes
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_department ON vehicles(responsible_department);

-- Reservations indexes
CREATE INDEX idx_reservations_driver_id ON reservations(driver_id);
CREATE INDEX idx_reservations_vehicle_id ON reservations(vehicle_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_start_date ON reservations(start_date);
CREATE INDEX idx_reservations_end_date ON reservations(end_date);

-- Documents indexes
CREATE INDEX idx_documents_entity_type_id ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_type ON documents(document_type);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Audit log indexes
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- User profiles policy
CREATE POLICY "Users can view own user profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own user profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Employees - visible based on role
CREATE POLICY "Employees visible to HR and admins" ON employees FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'rh', 'gestor_frota')
    )
);

-- Drivers - visible based on role
CREATE POLICY "Drivers visible to fleet managers and admins" ON drivers FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'gestor_frota')
    )
    OR auth.uid() IN (
        SELECT user_id FROM user_profiles 
        WHERE user_profiles.id = drivers.employee_id
    )
);

-- Vehicles - visible based on role
CREATE POLICY "Vehicles visible to authorized users" ON vehicles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'gestor_frota', 'condutor', 'visualizador')
    )
);

-- Reservations - users can see their own reservations
CREATE POLICY "Users can view own reservations" ON reservations FOR SELECT USING (
    auth.uid() = requester_id
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'gestor_frota')
    )
);

-- Documents - users can see documents they uploaded or are related to
CREATE POLICY "Users can view relevant documents" ON documents FOR SELECT USING (
    auth.uid() = uploaded_by
    OR EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'gestor_frota', 'rh')
    )
);

-- Notifications - users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Audit log - only admins can view
CREATE POLICY "Only admins can view audit log" ON audit_log FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check for expiring documents
CREATE OR REPLACE FUNCTION check_expiring_documents()
RETURNS void AS $$
BEGIN
    -- Check expiring CNH (30 days and 7 days before)
    INSERT INTO notifications (user_id, type, title, message, priority, related_entity_type, related_entity_id, scheduled_for)
    SELECT 
        u.id,
        'document_expiry',
        'CNH expirando em 30 dias',
        'A CNH do condutor ' || d.full_name || ' expira em ' || TO_CHAR(d.cnh_expiry_date, 'DD/MM/YYYY'),
        'high',
        'driver',
        d.id,
        NOW()
    FROM drivers d
    JOIN users u ON u.role IN ('admin', 'gestor_frota')
    WHERE d.cnh_expiry_date BETWEEN NOW()::date + INTERVAL '30 days' AND NOW()::date + INTERVAL '31 days'
    AND d.is_active = true;

    -- Check expiring internal terms (30 days before)
    INSERT INTO notifications (user_id, type, title, message, priority, related_entity_type, related_entity_id, scheduled_for)
    SELECT 
        u.id,
        'document_expiry',
        'Termo de Norma Interna expirando',
        'O termo de norma interna do condutor ' || d.full_name || ' expira em ' || TO_CHAR(d.internal_terms_expiry_date, 'DD/MM/YYYY'),
        'medium',
        'driver',
        d.id,
        NOW()
    FROM drivers d
    JOIN users u ON u.role IN ('admin', 'gestor_frota')
    WHERE d.internal_terms_expiry_date BETWEEN NOW()::date + INTERVAL '30 days' AND NOW()::date + INTERVAL '31 days'
    AND d.is_active = true;
END;
$$ language 'plpgsql';

-- Function to audit table changes
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, old_values)
        VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
        VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
        VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add audit triggers to important tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON vehicles FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
CREATE TRIGGER audit_drivers AFTER INSERT OR UPDATE OR DELETE ON drivers FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
CREATE TRIGGER audit_reservations AFTER INSERT OR UPDATE OR DELETE ON reservations FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

