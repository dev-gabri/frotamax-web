import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create separate client for storage operations (without schema)
const localAuthEnabled = process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTH_ENABLED === 'true';
const supabaseUrl = process.env.SUPABASE_URL || (localAuthEnabled ? 'http://127.0.0.1:54321' : undefined);
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (localAuthEnabled ? 'local-development-key' : undefined);

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseStorage = createClient(supabaseUrl, supabaseServiceKey);

export class StorageService {
  private static readonly BUCKET_NAME = 'frotamax';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  /**
   * Initialize the storage bucket if it doesn't exist
   */
  static async initializeBucket() {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabaseStorage.storage.listBuckets();
      
      if (listError) {
        console.error('Error listing buckets:', listError);
        throw listError;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);

      if (!bucketExists) {
        // Create bucket
        const { error: createError } = await supabaseStorage.storage.createBucket(this.BUCKET_NAME, {
          public: false,
          allowedMimeTypes: this.ALLOWED_MIME_TYPES,
          fileSizeLimit: this.MAX_FILE_SIZE
        });

        if (createError) {
          console.error('Error creating bucket:', createError);
          throw createError;
        }

        console.log(`Bucket '${this.BUCKET_NAME}' created successfully`);
      }
    } catch (error) {
      console.error('Error initializing storage bucket:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: Express.Multer.File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Tipo de arquivo não permitido. Formatos aceitos: PDF, JPG, PNG'
      };
    }

    return { isValid: true };
  }

  /**
   * Generate file path based on entity type and document type
   */
  static generateFilePath(entityType: string, entityId: string, documentType: string, fileName: string): string {
    const extension = fileName.split('.').pop();
    const uniqueId = uuidv4();
    return `${entityType}/${entityId}/${documentType}/${uniqueId}.${extension}`;
  }

  /**
   * Upload file to Supabase Storage
   */
  static async uploadFile(
    file: Express.Multer.File,
    entityType: string,
    entityId: string,
    documentType: string
  ): Promise<{ filePath: string; publicUrl: string }> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Generate unique file path
      const filePath = this.generateFilePath(entityType, entityId, documentType, file.originalname);

      // Upload file to Supabase Storage
      const { data, error } = await supabaseStorage.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Error uploading file:', error);
        throw error;
      }

      // Get public URL
      const { data: publicUrlData } = supabaseStorage.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      return {
        filePath: data.path,
        publicUrl: publicUrlData.publicUrl
      };
    } catch (error) {
      console.error('Error in uploadFile:', error);
      throw error;
    }
  }

  /**
   * Delete file from Supabase Storage
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await supabaseStorage.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteFile:', error);
      throw error;
    }
  }

  /**
   * Get signed URL for private file access
   */
  static async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabaseStorage.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error in getSignedUrl:', error);
      throw error;
    }
  }

  /**
   * List files in a specific folder
   */
  static async listFiles(folderPath: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseStorage.storage
        .from(this.BUCKET_NAME)
        .list(folderPath);

      if (error) {
        console.error('Error listing files:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in listFiles:', error);
      throw error;
    }
  }

  /**
   * Save document metadata to database
   */
  static async saveDocumentMetadata(
    entityType: string,
    entityId: string,
    documentType: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    mimeType: string,
    uploadedBy: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          document_type: documentType,
          file_name: fileName,
          file_path: filePath,
          file_size: fileSize,
          mime_type: mimeType,
          uploaded_by: uploadedBy,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving document metadata:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in saveDocumentMetadata:', error);
      throw error;
    }
  }

  /**
   * Get document metadata from database
   */
  static async getDocumentMetadata(
    entityType: string,
    entityId: string,
    documentType?: string
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (documentType) {
        query = query.eq('document_type', documentType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting document metadata:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getDocumentMetadata:', error);
      throw error;
    }
  }

  /**
   * Replace existing document (soft delete old, upload new)
   */
  static async replaceDocument(
    file: Express.Multer.File,
    entityType: string,
    entityId: string,
    documentType: string,
    uploadedBy: string
  ): Promise<any> {
    try {
      // Get existing document
      const existingDocs = await this.getDocumentMetadata(entityType, entityId, documentType);
      
      // Upload new file
      const { filePath, publicUrl } = await this.uploadFile(file, entityType, entityId, documentType);
      
      // Save new document metadata
      const newDocument = await this.saveDocumentMetadata(
        entityType,
        entityId,
        documentType,
        file.originalname,
        filePath,
        file.size,
        file.mimetype,
        uploadedBy
      );

      // Soft delete old documents
      if (existingDocs.length > 0) {
        for (const doc of existingDocs) {
          await supabase
            .from('documents')
            .update({ is_active: false })
            .eq('id', doc.id);
          
          // Optionally delete the actual file
          try {
            await this.deleteFile(doc.file_path);
          } catch (deleteError) {
            console.warn('Could not delete old file:', deleteError);
          }
        }
      }

      return { ...newDocument, publicUrl };
    } catch (error) {
      console.error('Error in replaceDocument:', error);
      throw error;
    }
  }
}
