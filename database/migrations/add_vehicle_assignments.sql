-- Migration: Add vehicle assignment functionality
-- Description: Creates tables and relationships for permanent and temporary vehicle assignments

-- Set the schema
SET search_path TO log_frotamax;

-- Create vehicle_assignments table
CREATE TABLE IF NOT EXISTS log_frotamax.vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('permanent', 'temporary')),
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for permanent assignments
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assignment_history table for audit trail
CREATE TABLE IF NOT EXISTS log_frotamax.assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES vehicle_assignments(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'modified', 'terminated')),
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    old_values JSONB,
    new_values JSONB,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add assignment reference to vehicles table
ALTER TABLE log_frotamax.vehicles 
ADD COLUMN IF NOT EXISTS current_assignment_id UUID REFERENCES vehicle_assignments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_permanently_assigned BOOLEAN DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle_id ON log_frotamax.vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_driver_id ON log_frotamax.vehicle_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_status ON log_frotamax.vehicle_assignments(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_start_date ON log_frotamax.vehicle_assignments(start_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_end_date ON log_frotamax.vehicle_assignments(end_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_type ON log_frotamax.vehicle_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assignment_id ON log_frotamax.assignment_history(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_created_at ON log_frotamax.assignment_history(created_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_current_assignment ON log_frotamax.vehicles(current_assignment_id);

-- Create constraint to prevent overlapping permanent assignments for the same vehicle
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_permanent_assignment 
ON log_frotamax.vehicle_assignments(vehicle_id) 
WHERE assignment_type = 'permanent' AND status = 'active';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vehicle_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_assignments_updated_at
    BEFORE UPDATE ON log_frotamax.vehicle_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_assignments_updated_at();

-- Create trigger to log assignment changes
CREATE OR REPLACE FUNCTION log_assignment_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO assignment_history (assignment_id, action, changed_by, new_values)
        VALUES (NEW.id, 'created', NEW.assigned_by, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO assignment_history (assignment_id, action, changed_by, old_values, new_values)
        VALUES (NEW.id, 'modified', NEW.assigned_by, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO assignment_history (assignment_id, action, changed_by, old_values)
        VALUES (OLD.id, 'terminated', OLD.assigned_by, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_assignment_changes
    AFTER INSERT OR UPDATE OR DELETE ON log_frotamax.vehicle_assignments
    FOR EACH ROW
    EXECUTE FUNCTION log_assignment_changes();

-- Create trigger to update vehicle assignment status
CREATE OR REPLACE FUNCTION update_vehicle_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        -- Update vehicle's current assignment and permanent status
        UPDATE vehicles 
        SET current_assignment_id = NEW.id,
            is_permanently_assigned = (NEW.assignment_type = 'permanent'),
            status = CASE 
                WHEN NEW.assignment_type = 'permanent' THEN 'em_uso'
                ELSE status
            END
        WHERE id = NEW.vehicle_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'active' AND OLD.status != 'active' THEN
            -- Assignment became active
            UPDATE vehicles 
            SET current_assignment_id = NEW.id,
                is_permanently_assigned = (NEW.assignment_type = 'permanent'),
                status = CASE 
                    WHEN NEW.assignment_type = 'permanent' THEN 'em_uso'
                    ELSE status
                END
            WHERE id = NEW.vehicle_id;
            
        ELSIF NEW.status != 'active' AND OLD.status = 'active' THEN
            -- Assignment became inactive
            UPDATE vehicles 
            SET current_assignment_id = NULL,
                is_permanently_assigned = false,
                status = CASE 
                    WHEN OLD.assignment_type = 'permanent' THEN 'disponivel'
                    ELSE status
                END
            WHERE id = NEW.vehicle_id;
        END IF;
        
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        -- Assignment deleted
        UPDATE vehicles 
        SET current_assignment_id = NULL,
            is_permanently_assigned = false,
            status = CASE 
                WHEN OLD.assignment_type = 'permanent' THEN 'disponivel'
                ELSE status
            END
        WHERE id = OLD.vehicle_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_assignment_status
    AFTER INSERT OR UPDATE OR DELETE ON log_frotamax.vehicle_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_assignment_status();

-- Enable Row Level Security
ALTER TABLE log_frotamax.vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_frotamax.assignment_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vehicle_assignments
CREATE POLICY "Users can view assignments" ON log_frotamax.vehicle_assignments FOR SELECT
    USING (true);

CREATE POLICY "Admins and fleet managers can insert assignments" ON log_frotamax.vehicle_assignments FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'gestor_frota'));

CREATE POLICY "Admins and fleet managers can update assignments" ON log_frotamax.vehicle_assignments FOR UPDATE
    USING (auth.jwt() ->> 'role' IN ('admin', 'gestor_frota'));

CREATE POLICY "Admins and fleet managers can delete assignments" ON log_frotamax.vehicle_assignments FOR DELETE
    USING (auth.jwt() ->> 'role' IN ('admin', 'gestor_frota'));

-- Create RLS policies for assignment_history
CREATE POLICY "Users can view assignment history" ON log_frotamax.assignment_history FOR SELECT
    USING (true);

CREATE POLICY "System can insert into assignment history" ON log_frotamax.assignment_history FOR INSERT
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE log_frotamax.vehicle_assignments IS 'Stores vehicle-driver assignments (both permanent and temporary)';
COMMENT ON TABLE log_frotamax.assignment_history IS 'Audit trail for all assignment changes';
COMMENT ON COLUMN log_frotamax.vehicle_assignments.assignment_type IS 'Type of assignment: permanent (long-term) or temporary (short-term)';
COMMENT ON COLUMN log_frotamax.vehicle_assignments.end_date IS 'End date for temporary assignments; NULL for permanent assignments';
COMMENT ON COLUMN log_frotamax.vehicles.current_assignment_id IS 'Reference to current active assignment';
COMMENT ON COLUMN log_frotamax.vehicles.is_permanently_assigned IS 'Flag indicating if vehicle has a permanent assignment';