import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';
import { requireFleetManager, requireAdmin } from '../middleware/auth';
import { 
  uploadDocument, 
  validateDocumentUpload, 
  processDocumentUpload, 
  replaceDocument, 
  validateEntityAccess 
} from '../middleware/documentUpload';
import { StorageService } from '../services/storageService';
import { DOCUMENT_TYPES, ENTITY_TYPES } from '../constants/documentTypes';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get all vehicles
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('license_plate');

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar veículos'
      });
    }

    res.json({
      success: true,
      data: vehicles
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get single vehicle
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Veículo não encontrado'
      });
    }

    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Create new vehicle
router.post('/', requireFleetManager, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      license_plate,
      chassis_number,
      renavam,
      internal_code,
      brand,
      model,
      manufacture_year,
      model_year,
      category,
      fuel_type,
      responsible_department,
      cost_center,
      base_city,
      acquisition_value,
      acquisition_date,
      warranty_supplier,
      warranty_period_months,
      warranty_special_conditions,
      warranty_covered_items,
      status
    } = req.body;

    // Validate required fields
    if (!license_plate || !chassis_number || !renavam || !brand || !model || !manufacture_year || !model_year || !category || !fuel_type || !responsible_department || !cost_center || !base_city) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: placa, chassi, RENAVAM, marca, modelo, ano de fabricação, ano do modelo, categoria, combustível, departamento responsável, centro de custo e cidade base'
      });
    }

    // Check if vehicle with same license plate, chassis or RENAVAM already exists
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id')
      .or(`license_plate.eq.${license_plate},chassis_number.eq.${chassis_number},renavam.eq.${renavam}`)
      .single();

    if (existingVehicle) {
      return res.status(409).json({
        success: false,
        error: 'Já existe um veículo com esta placa, chassi ou RENAVAM'
      });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        license_plate: license_plate.toUpperCase(),
        chassis_number: chassis_number.toUpperCase(),
        renavam,
        internal_code,
        brand,
        model,
        manufacture_year: parseInt(manufacture_year),
        model_year: parseInt(model_year),
        category,
        fuel_type,
        responsible_department,
        cost_center,
        base_city,
        acquisition_value: acquisition_value ? parseFloat(acquisition_value) : null,
        acquisition_date,
        warranty_supplier,
        warranty_period_months: warranty_period_months ? parseInt(warranty_period_months) : null,
        warranty_special_conditions,
        warranty_covered_items,
        status: status || 'disponivel',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Create vehicle error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar veículo'
      });
    }

    res.status(201).json({
      success: true,
      data: vehicle,
      message: 'Veículo criado com sucesso'
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Update vehicle
router.put('/:id', requireFleetManager, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove id from update data if present
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Normalize text fields
    if (updateData.license_plate) {
      updateData.license_plate = updateData.license_plate.toUpperCase();
    }
    if (updateData.chassis_number) {
      updateData.chassis_number = updateData.chassis_number.toUpperCase();
    }

    // Convert numeric fields
    if (updateData.manufacture_year) {
      updateData.manufacture_year = parseInt(updateData.manufacture_year);
    }
    if (updateData.model_year) {
      updateData.model_year = parseInt(updateData.model_year);
    }
    if (updateData.acquisition_value) {
      updateData.acquisition_value = parseFloat(updateData.acquisition_value);
    }
    if (updateData.warranty_period_months) {
      updateData.warranty_period_months = parseInt(updateData.warranty_period_months);
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update vehicle error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar veículo'
      });
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Veículo não encontrado'
      });
    }

    res.json({
      success: true,
      data: vehicle,
      message: 'Veículo atualizado com sucesso'
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Update vehicle status
router.patch('/:id/status', requireFleetManager, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['disponivel', 'em_uso', 'manutencao', 'indisponivel'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status deve ser: disponivel, em_uso, manutencao ou indisponivel'
      });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update vehicle status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status do veículo'
      });
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Veículo não encontrado'
      });
    }

    res.json({
      success: true,
      data: vehicle,
      message: 'Status do veículo atualizado com sucesso'
    });
  } catch (error) {
    console.error('Update vehicle status error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Delete vehicle (soft delete - set is_active to false)
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if vehicle has active reservations
    const { data: activeReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('vehicle_id', id)
      .in('status', ['pendente', 'aprovada', 'em_andamento']);

    if (activeReservations && activeReservations.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível excluir veículo com reservas ativas'
      });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update({ 
        is_active: false,
        status: 'indisponivel',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Delete vehicle error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir veículo'
      });
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Veículo não encontrado'
      });
    }

    res.json({
      success: true,
      data: vehicle,
      message: 'Veículo excluído com sucesso'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Reactivate vehicle
router.patch('/:id/reactivate', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update({ 
        is_active: true,
        status: 'disponivel',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Reactivate vehicle error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao reativar veículo'
      });
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Veículo não encontrado'
      });
    }

    res.json({
      success: true,
      data: vehicle,
      message: 'Veículo reativado com sucesso'
    });
  } catch (error) {
    console.error('Reactivate vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Upload DUT document
router.post(
  '/:id/upload-dut',
  requireFleetManager,
  uploadDocument.single('document'),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Add document type to request body
      req.body.entityType = ENTITY_TYPES.VEHICLE;
      req.body.entityId = req.params.id;
      req.body.documentType = DOCUMENT_TYPES.VEHICLE.DUT;
      
      // Continue with middleware chain
      validateDocumentUpload(req, res, () => {
        validateEntityAccess(req, res, () => {
          replaceDocument(req, res, () => {
            if (!req.processedDocument) {
              return res.status(400).json({
                success: false,
                error: 'Erro ao processar documento'
              });
            }

            res.json({
              success: true,
              data: req.processedDocument,
              message: 'DUT enviado com sucesso'
            });
          });
        });
      });
    } catch (error) {
      console.error('Upload DUT error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

// Upload vehicle document
router.post(
  '/:id/upload-document',
  requireFleetManager,
  uploadDocument.single('document'),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Add entity info to request body
      req.body.entityType = ENTITY_TYPES.VEHICLE;
      req.body.entityId = req.params.id;
      // documentType should be provided in request body
      
      // Continue with middleware chain
      validateDocumentUpload(req, res, () => {
        validateEntityAccess(req, res, () => {
          processDocumentUpload(req, res, () => {
            if (!req.processedDocument) {
              return res.status(400).json({
                success: false,
                error: 'Erro ao processar documento'
              });
            }

            res.json({
              success: true,
              data: req.processedDocument,
              message: `${req.processedDocument.documentTypeLabel} enviado com sucesso`
            });
          });
        });
      });
    } catch (error) {
      console.error('Upload vehicle document error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

// Get vehicle documents
router.get('/:id/documents', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    // Check permissions
    const canAccess = 
      userRole === 'admin' ||
      userRole === 'gestor_frota';

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Get vehicle documents
    const documents = await StorageService.getDocumentMetadata(
      ENTITY_TYPES.VEHICLE,
      id
    );

    // Add signed URLs for file access
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const signedUrl = await StorageService.getSignedUrl(doc.file_path);
        return {
          ...doc,
          signedUrl
        };
      })
    );

    res.json({
      success: true,
      data: documentsWithUrls
    });
  } catch (error) {
    console.error('Get vehicle documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get specific vehicle document
router.get('/:id/documents/:documentType', async (req: AuthenticatedRequest, res) => {
  try {
    const { id, documentType } = req.params;
    const userRole = req.user?.role;

    // Check permissions
    const canAccess = 
      userRole === 'admin' ||
      userRole === 'gestor_frota';

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Get specific document
    const documents = await StorageService.getDocumentMetadata(
      ENTITY_TYPES.VEHICLE,
      id,
      documentType
    );

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    const document = documents[0];
    const signedUrl = await StorageService.getSignedUrl(document.file_path);

    res.json({
      success: true,
      data: {
        ...document,
        signedUrl
      }
    });
  } catch (error) {
    console.error('Get vehicle document error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;