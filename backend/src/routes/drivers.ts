import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';
import { requireHR, requireAdmin } from '../middleware/auth';
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

// Get all drivers
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('*')
      .order('full_name');

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar condutores'
      });
    }

    res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Search employees for driver registration
router.get('/search-employees', async (req: AuthenticatedRequest, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Determine if query looks like CPF (numbers) or name/employee_id
    const isCpfQuery = /^\d+$/.test(q.replace(/[.-]/g, ''));
    
    let employees, error;
    
    if (isCpfQuery) {
      // Search by CPF if query contains only numbers
      ({ data: employees, error } = await supabase
        .schema('public')
        .rpc('get_employees', {
          p_cpf: q,
          p_name_query: null,
          p_status: null, // Changed from 'active' to null
          p_termination_after: null,
          p_limit: 10,
          p_offset: 0,
          p_order_by: 'full_name',
          p_order: 'ASC'
        }));
    } else {
      // Search by name/employee_id for text queries
      ({ data: employees, error } = await supabase
        .schema('public')
        .rpc('get_employees', {
          p_cpf: null,
          p_name_query: q,
          p_status: null, // Changed from 'active' to null
          p_termination_after: null,
          p_limit: 10,
          p_offset: 0,
          p_order_by: 'full_name',
          p_order: 'ASC'
        }));
    }

    if (error) {
      console.error('Search employees error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar colaboradores'
      });
    }

    // Filter only active employees (status 'A') and map to expected format
    const filteredEmployees = (employees || [])
      .filter((emp: any) => emp.status === 'A')
      .map((emp: any) => ({
        id: emp.id, // Use the UUID id from employees table
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        cpf: emp.cpf
      }));


    res.json({
      success: true,
      data: filteredEmployees
    });
  } catch (error) {
    console.error('Search employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get single driver
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    const { data: driver, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Condutor não encontrado'
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Create new driver
router.post('/', requireHR, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      employee_id,
      cpf,
      full_name,
      email,
      phone,
      cnh_number,
      cnh_category,
      cnh_expiry_date,
      internal_terms_status,
      internal_terms_signed_date,
      internal_terms_expiry_date
    } = req.body;

    // Validate required fields
    if (!cpf || !full_name || !cnh_number || !cnh_category || !cnh_expiry_date) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: CPF, nome completo, número da CNH, categoria e data de vencimento'
      });
    }

    // Check if driver with same CPF or CNH already exists
    const { data: existingDriver } = await supabase
      .from('drivers')
      .select('id')
      .or(`cpf.eq.${cpf},cnh_number.eq.${cnh_number}`)
      .single();

    if (existingDriver) {
      return res.status(409).json({
        success: false,
        error: 'Já existe um condutor com este CPF ou número de CNH'
      });
    }

    // If no employee_id provided, check if CPF corresponds to an existing employee
    let finalEmployeeId = employee_id;
    let finalFullName = full_name;
    
    if (!employee_id) {
      // Search for employee by CPF using RPC function
      const { data: employeeData } = await supabase
        .schema('public')
        .rpc('get_employees', {
          p_cpf: cpf,
          p_name_query: null,
          p_status: null,
          p_termination_after: null,
          p_limit: 1,
          p_offset: 0,
          p_order_by: 'full_name',
          p_order: 'ASC'
        });

      const existingEmployee = employeeData?.find((emp: any) => emp.status === 'A' && emp.cpf === cpf);
      
      if (existingEmployee) {
        finalEmployeeId = existingEmployee.id; // Use UUID id, not employee_id
        finalFullName = existingEmployee.full_name;
      }
    } else {
      // If employee_id provided, use it directly (already validated in frontend)
      finalEmployeeId = employee_id;
      finalFullName = full_name;
    }

    console.log('Creating driver with data:', {
      employee_id: finalEmployeeId,
      cpf,
      full_name: finalFullName,
      email,
      phone,
      cnh_number,
      cnh_category,
      cnh_expiry_date,
      internal_terms_status: internal_terms_status || 'pending',
      internal_terms_signed_date,
      internal_terms_expiry_date,
      is_active: true
    });

    const { data: driver, error } = await supabase
      .from('drivers')
      .insert({
        employee_id: finalEmployeeId,
        cpf,
        full_name: finalFullName,
        email,
        phone,
        cnh_number,
        cnh_category,
        cnh_expiry_date,
        internal_terms_status: internal_terms_status || 'pending',
        internal_terms_signed_date,
        internal_terms_expiry_date,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Create driver error details:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return res.status(500).json({
        success: false,
        error: `Erro ao criar condutor: ${error.message || 'Erro desconhecido'}`
      });
    }

    res.status(201).json({
      success: true,
      data: driver,
      message: 'Condutor criado com sucesso'
    });
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Update driver
router.put('/:id', requireHR, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove id from update data if present
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;

    const { data: driver, error } = await supabase
      .from('drivers')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update driver error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar condutor'
      });
    }

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Condutor não encontrado'
      });
    }

    res.json({
      success: true,
      data: driver,
      message: 'Condutor atualizado com sucesso'
    });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Delete driver (soft delete - set is_active to false)
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if driver has active reservations
    const { data: activeReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('driver_id', id)
      .in('status', ['pendente', 'aprovada', 'em_andamento']);

    if (activeReservations && activeReservations.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível excluir condutor com reservas ativas'
      });
    }

    const { data: driver, error } = await supabase
      .from('drivers')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Delete driver error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir condutor'
      });
    }

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Condutor não encontrado'
      });
    }

    res.json({
      success: true,
      data: driver,
      message: 'Condutor excluído com sucesso'
    });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Reactivate driver
router.patch('/:id/reactivate', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { data: driver, error } = await supabase
      .from('drivers')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Reactivate driver error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao reativar condutor'
      });
    }

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Condutor não encontrado'
      });
    }

    res.json({
      success: true,
      data: driver,
      message: 'Condutor reativado com sucesso'
    });
  } catch (error) {
    console.error('Reactivate driver error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Upload CNH document
router.post(
  '/:id/upload-cnh',
  uploadDocument.single('document'),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Add document type to request body
      req.body.entityType = ENTITY_TYPES.DRIVER;
      req.body.entityId = req.params.id;
      req.body.documentType = DOCUMENT_TYPES.DRIVER.CNH;
      
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
              message: 'CNH enviada com sucesso'
            });
          });
        });
      });
    } catch (error) {
      console.error('Upload CNH error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

// Upload internal terms document
router.post(
  '/:id/upload-terms',
  uploadDocument.single('document'),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Add document type to request body
      req.body.entityType = ENTITY_TYPES.DRIVER;
      req.body.entityId = req.params.id;
      req.body.documentType = DOCUMENT_TYPES.DRIVER.INTERNAL_TERMS;
      
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
              message: 'Termo de normas internas enviado com sucesso'
            });
          });
        });
      });
    } catch (error) {
      console.error('Upload terms error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

// Get driver documents
router.get('/:id/documents', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Check permissions
    const canAccess = 
      userRole === 'admin' ||
      userRole === 'gestor_frota' ||
      userRole === 'rh';

    // If conductor, check if they own this driver record
    if (userRole === 'condutor') {
      const { data: driver } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('id', id)
        .single();

      if (driver?.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado'
        });
      }
    }

    if (!canAccess && userRole !== 'condutor') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Get driver documents
    const documents = await StorageService.getDocumentMetadata(
      ENTITY_TYPES.DRIVER,
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
    console.error('Get driver documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get specific driver document
router.get('/:id/documents/:documentType', async (req: AuthenticatedRequest, res) => {
  try {
    const { id, documentType } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Check permissions
    const canAccess = 
      userRole === 'admin' ||
      userRole === 'gestor_frota' ||
      userRole === 'rh';

    // If conductor, check if they own this driver record
    if (userRole === 'condutor') {
      const { data: driver } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('id', id)
        .single();

      if (driver?.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado'
        });
      }
    }

    if (!canAccess && userRole !== 'condutor') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Get specific document
    const documents = await StorageService.getDocumentMetadata(
      ENTITY_TYPES.DRIVER,
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
    console.error('Get driver document error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;