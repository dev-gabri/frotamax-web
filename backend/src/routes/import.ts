import { Router } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { supabase } from '../services/supabaseClient';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

interface DriverImportRow {
  cpf: string;
  full_name: string;
  cnh_number: string;
  cnh_category: string;
  cnh_expiry_date: string;
  email?: string;
  phone?: string;
  internal_terms_status?: string;
  internal_terms_signed_date?: string;
  internal_terms_expiry_date?: string;
}

interface VehicleImportRow {
  license_plate: string;
  chassis_number: string;
  renavam: string;
  brand: string;
  model: string;
  manufacture_year: string;
  model_year: string;
  category: string;
  fuel_type: string;
  responsible_department: string;
  cost_center: string;
  base_city: string;
  internal_code?: string;
  acquisition_value?: string;
  acquisition_date?: string;
  warranty_supplier?: string;
  warranty_period_months?: string;
  warranty_special_conditions?: string;
  warranty_covered_items?: string;
  status?: string;
}

const parseCSV = (buffer: Buffer): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    
    stream
      .pipe(csv())
      .on('data', (data) => {
        // Clean up the data by trimming all string values
        const cleanedData: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string') {
            cleanedData[key.trim()] = value.trim();
          } else {
            cleanedData[key.trim()] = value;
          }
        }
        results.push(cleanedData);
      })
      .on('end', () => {
        console.log(`📊 Total rows parsed: ${results.length}`);
        resolve(results);
      })
      .on('error', reject);
  });
};

const validateDriverRow = (row: DriverImportRow): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!row.cpf || !row.cpf.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
    errors.push('CPF is required and must be in format XXX.XXX.XXX-XX');
  }
  
  if (!row.full_name || row.full_name.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
  }
  
  if (!row.cnh_number || row.cnh_number.trim().length < 8) {
    errors.push('CNH number is required and must be at least 8 characters');
  }
  
  if (!row.cnh_category || !['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'].includes(row.cnh_category)) {
    errors.push('CNH category must be one of: A, B, C, D, E, AB, AC, AD, AE');
  }
  
  if (!row.cnh_expiry_date || !row.cnh_expiry_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    errors.push('CNH expiry date is required and must be in format YYYY-MM-DD');
  }
  
  if (row.email && !row.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.push('Email must be valid if provided');
  }
  
  if (row.internal_terms_status && !['pending', 'signed', 'expired'].includes(row.internal_terms_status)) {
    errors.push('Internal terms status must be one of: pending, signed, expired');
  }
  
  return { isValid: errors.length === 0, errors };
};

const validateVehicleRow = (row: VehicleImportRow): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!row.license_plate || row.license_plate.trim().length < 7) {
    errors.push('License plate is required and must be at least 7 characters');
  }
  
  if (!row.chassis_number || row.chassis_number.trim().length < 10) {
    errors.push('Chassis number is required and must be at least 10 characters');
  }
  
  if (!row.renavam || row.renavam.trim().length < 8) {
    errors.push('RENAVAM is required and must be at least 8 characters');
  }
  
  if (!row.brand || row.brand.trim().length < 2) {
    errors.push('Brand is required and must be at least 2 characters');
  }
  
  if (!row.model || row.model.trim().length < 2) {
    errors.push('Model is required and must be at least 2 characters');
  }
  
  if (!row.manufacture_year || isNaN(parseInt(row.manufacture_year)) || parseInt(row.manufacture_year) < 1950) {
    errors.push('Manufacture year must be a valid year >= 1950');
  }
  
  if (!row.model_year || isNaN(parseInt(row.model_year)) || parseInt(row.model_year) < 1950) {
    errors.push('Model year must be a valid year >= 1950');
  }
  
  if (!row.category || row.category.trim().length < 2) {
    errors.push('Category is required and must be at least 2 characters');
  }
  
  if (!row.fuel_type || !['gasolina', 'etanol', 'diesel', 'flex', 'gnv', 'eletrico', 'hibrido'].includes(row.fuel_type)) {
    errors.push('Fuel type must be one of: gasolina, etanol, diesel, flex, gnv, eletrico, hibrido');
  }
  
  if (!row.responsible_department || row.responsible_department.trim().length < 2) {
    errors.push('Responsible department is required and must be at least 2 characters');
  }
  
  if (!row.cost_center || row.cost_center.trim().length < 2) {
    errors.push('Cost center is required and must be at least 2 characters');
  }
  
  if (!row.base_city || row.base_city.trim().length < 2) {
    errors.push('Base city is required and must be at least 2 characters');
  }
  
  if (row.status && !['disponivel', 'em_uso', 'manutencao', 'indisponivel'].includes(row.status)) {
    errors.push('Status must be one of: disponivel, em_uso, manutencao, indisponivel');
  }
  
  return { isValid: errors.length === 0, errors };
};

router.post('/drivers', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const rows = await parseCSV(req.file.buffer);
    const validRows: any[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];
    
    // Validate all rows
    rows.forEach((row, index) => {
      const validation = validateDriverRow(row);
      if (validation.isValid) {
        validRows.push({
          cpf: row.cpf,
          full_name: row.full_name,
          cnh_number: row.cnh_number,
          cnh_category: row.cnh_category,
          cnh_expiry_date: row.cnh_expiry_date,
          email: row.email || null,
          phone: row.phone || null,
          internal_terms_status: row.internal_terms_status || 'pending',
          internal_terms_signed_date: row.internal_terms_signed_date || null,
          internal_terms_expiry_date: row.internal_terms_expiry_date || null,
          is_active: true
        });
      } else {
        errors.push({ row: index + 1, errors: validation.errors });
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation errors found', 
        errors,
        validRows: validRows.length,
        totalRows: rows.length
      });
    }
    
    // Insert valid rows
    const { data, error } = await supabase
      .from('drivers')
      .insert(validRows);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      message: `Successfully imported ${validRows.length} drivers`,
      importedCount: validRows.length
    });
    
  } catch (error) {
    console.error('Error importing drivers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/vehicles', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const rows = await parseCSV(req.file.buffer);
    console.log('📊 Parsed CSV rows for vehicles:', rows.length);
    
    const validRows: any[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];
    
    // Validate all rows
    rows.forEach((row, index) => {
      const validation = validateVehicleRow(row);
      if (validation.isValid) {
        validRows.push({
          license_plate: row.license_plate,
          chassis_number: row.chassis_number,
          renavam: row.renavam,
          brand: row.brand,
          model: row.model,
          manufacture_year: parseInt(row.manufacture_year),
          model_year: parseInt(row.model_year),
          category: row.category,
          fuel_type: row.fuel_type,
          responsible_department: row.responsible_department,
          cost_center: row.cost_center,
          base_city: row.base_city,
          internal_code: row.internal_code || null,
          acquisition_value: row.acquisition_value ? parseFloat(row.acquisition_value) : null,
          acquisition_date: row.acquisition_date || null,
          warranty_supplier: row.warranty_supplier || null,
          warranty_period_months: row.warranty_period_months ? parseInt(row.warranty_period_months) : null,
          warranty_special_conditions: row.warranty_special_conditions || null,
          warranty_covered_items: row.warranty_covered_items || null,
          status: row.status || 'disponivel',
          is_active: true
        });
      } else {
        errors.push({ row: index + 1, errors: validation.errors });
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation errors found', 
        errors,
        validRows: validRows.length,
        totalRows: rows.length
      });
    }
    
    // Insert valid rows
    const { data, error } = await supabase
      .from('vehicles')
      .insert(validRows);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      message: `Successfully imported ${validRows.length} vehicles`,
      importedCount: validRows.length
    });
    
  } catch (error) {
    console.error('Error importing vehicles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;