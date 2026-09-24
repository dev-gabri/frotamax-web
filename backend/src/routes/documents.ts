import { authMiddleware } from '../middleware/auth';
import { Router } from 'express';
import { supabase } from '../services/supabaseClient';
import { AuthenticatedRequest } from '../types';
import { 
  uploadDocument, 
  validateDocumentUpload, 
  processDocumentUpload, 
  replaceDocument, 
  validateEntityAccess 
} from '../middleware/documentUpload';
import { StorageService } from '../services/storageService';
import { 
  DOCUMENT_TYPES, 
  ENTITY_TYPES, 
  getDocumentTypeLabel, 
  getAvailableDocumentTypes,
  getRequiredDocuments
} from '../constants/documentTypes';

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get all documents (admin only)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user?.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documentos'
      });
    }

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Get documents by entity
router.get('/entity/:entityType/:entityId', validateEntityAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { documentType } = req.query;

    const documents = await StorageService.getDocumentMetadata(
      entityType,
      entityId,
      documentType as string
    );

    // Add document type labels and signed URLs
    const documentsWithDetails = await Promise.all(
      documents.map(async (doc) => {
        const signedUrl = await StorageService.getSignedUrl(doc.file_path);
        return {
          ...doc,
          documentTypeLabel: getDocumentTypeLabel(doc.document_type),
          signedUrl
        };
      })
    );

    res.json({
      success: true,
      data: documentsWithDetails
    });
  } catch (error) {
    console.error('Get entity documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar documentos'
    });
  }
});

// Get available document types for entity
router.get('/types/:entityType', async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType } = req.params;
    
    const availableTypes = getAvailableDocumentTypes(entityType);
    const requiredTypes = getRequiredDocuments(entityType);
    
    const typesWithLabels = availableTypes.map(type => ({
      type,
      label: getDocumentTypeLabel(type),
      required: requiredTypes.includes(type)
    }));

    res.json({
      success: true,
      data: {
        entityType,
        availableTypes: typesWithLabels,
        requiredTypes
      }
    });
  } catch (error) {
    console.error('Get document types error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar tipos de documento'
    });
  }
});

// Upload document
router.post(
  '/upload',
  uploadDocument.single('document'),
  validateDocumentUpload,
  validateEntityAccess,
  processDocumentUpload,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.processedDocument) {
        return res.status(400).json({
          success: false,
          error: 'Erro ao processar documento'
        });
      }

      res.status(201).json({
        success: true,
        data: req.processedDocument,
        message: `${req.processedDocument.documentTypeLabel} enviado com sucesso`
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

// Replace document
router.put(
  '/replace',
  uploadDocument.single('document'),
  validateDocumentUpload,
  validateEntityAccess,
  replaceDocument,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.processedDocument) {
        return res.status(400).json({
          success: false,
          error: 'Erro ao processar documento'
        });
      }

      res.json({
        success: true,
        data: req.processedDocument,
        message: `${req.processedDocument.documentTypeLabel} substituído com sucesso`
      });
    } catch (error) {
      console.error('Replace document error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
);

// Get document by ID
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Get document metadata
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !document) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Check permissions
    const canAccess = 
      userRole === 'admin' ||
      document.uploaded_by === userId ||
      (userRole === 'gestor_frota' && ['driver', 'vehicle'].includes(document.entity_type)) ||
      (userRole === 'rh' && ['driver', 'user'].includes(document.entity_type));

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Get signed URL for file access
    const signedUrl = await StorageService.getSignedUrl(document.file_path);

    res.json({
      success: true,
      data: {
        ...document,
        documentTypeLabel: getDocumentTypeLabel(document.document_type),
        signedUrl
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Delete document (soft delete)
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Get document metadata
    const { data: document, error: getError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (getError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Check permissions
    const canDelete = 
      userRole === 'admin' ||
      document.uploaded_by === userId ||
      (userRole === 'gestor_frota' && ['driver', 'vehicle'].includes(document.entity_type)) ||
      (userRole === 'rh' && ['driver', 'user'].includes(document.entity_type));

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Soft delete document
    const { error: deleteError } = await supabase
      .from('documents')
      .update({ is_active: false })
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir documento'
      });
    }

    // Optionally delete file from storage
    try {
      await StorageService.deleteFile(document.file_path);
    } catch (storageError) {
      console.warn('Could not delete file from storage:', storageError);
    }

    res.json({
      success: true,
      message: 'Documento excluído com sucesso'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Initialize storage bucket on server start
if (!(process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTH_ENABLED === 'true')) {
  StorageService.initializeBucket().catch(console.error);
}

export default router;
