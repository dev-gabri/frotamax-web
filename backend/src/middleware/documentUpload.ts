import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService';
import { isValidDocumentType, getDocumentTypeLabel } from '../constants/documentTypes';

// Configure multer for document uploads (memory storage for Supabase)
const documentStorage = multer.memoryStorage();

// File filter for documents
const documentFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Formatos aceitos: PDF, JPG, PNG'));
  }
};

// Create multer instance for document uploads
export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware to validate document upload parameters
export const validateDocumentUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, documentType } = req.body;

    // Validate required parameters
    if (!entityType || !entityId || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: entityType, entityId, documentType'
      });
    }

    // Validate document type for entity type
    if (!isValidDocumentType(entityType, documentType)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de documento '${documentType}' não é válido para entidade '${entityType}'`
      });
    }

    // Validate file presence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    // Validate file using StorageService
    const validation = StorageService.validateFile(req.file);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Add validation info to request
    req.documentUpload = {
      entityType,
      entityId,
      documentType,
      documentTypeLabel: getDocumentTypeLabel(documentType),
      isValid: true
    };

    next();
  } catch (error) {
    console.error('Error validating document upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Middleware to process document upload
export const processDocumentUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file || !req.documentUpload) {
      return next();
    }

    const { entityType, entityId, documentType } = req.documentUpload;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // Upload file to Supabase Storage
    const { filePath, publicUrl } = await StorageService.uploadFile(
      req.file,
      entityType,
      entityId,
      documentType
    );

    // Save document metadata to database
    const documentMetadata = await StorageService.saveDocumentMetadata(
      entityType,
      entityId,
      documentType,
      req.file.originalname,
      filePath,
      req.file.size,
      req.file.mimetype,
      userId
    );

    // Add processed document info to request
    req.processedDocument = {
      ...documentMetadata,
      publicUrl,
      documentTypeLabel: req.documentUpload.documentTypeLabel
    };

    next();
  } catch (error) {
    console.error('Error processing document upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar upload do documento'
    });
  }
};

// Middleware to replace existing document
export const replaceDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file || !req.documentUpload) {
      return next();
    }

    const { entityType, entityId, documentType } = req.documentUpload;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // Replace existing document
    const documentMetadata = await StorageService.replaceDocument(
      req.file,
      entityType,
      entityId,
      documentType,
      userId
    );

    // Add processed document info to request
    req.processedDocument = {
      ...documentMetadata,
      documentTypeLabel: req.documentUpload.documentTypeLabel
    };

    next();
  } catch (error) {
    console.error('Error replacing document:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao substituir documento'
    });
  }
};

// Middleware to validate entity access permissions
export const validateEntityAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.documentUpload || req.body;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userRole || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // Admin can access all entities
    if (userRole === 'admin') {
      return next();
    }

    // Fleet manager can access vehicles and drivers
    if (userRole === 'gestor_frota' && (entityType === 'vehicle' || entityType === 'driver')) {
      return next();
    }

    // HR can access drivers and employees
    if (userRole === 'rh' && (entityType === 'driver' || entityType === 'user')) {
      return next();
    }

    // Driver can only access their own documents
    if (userRole === 'condutor' && entityType === 'driver') {
      // Check if the driver belongs to the current user
      const { supabase } = await import('../services/supabaseClient');
      const { data: driver } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('id', entityId)
        .single();

      if (driver?.user_id === userId) {
        return next();
      }
    }

    // Users can access their own user documents
    if (entityType === 'user' && entityId === userId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Acesso negado para esta entidade'
    });
  } catch (error) {
    console.error('Error validating entity access:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      documentUpload?: {
        entityType: string;
        entityId: string;
        documentType: string;
        documentTypeLabel: string;
        isValid: boolean;
      };
      processedDocument?: {
        id: string;
        entity_type: string;
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
        publicUrl: string;
        documentTypeLabel: string;
      };
    }
  }
}