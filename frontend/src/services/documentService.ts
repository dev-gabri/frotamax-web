import { apiService } from './apiService';

export interface DocumentType {
  type: string;
  label: string;
  required: boolean;
}

export interface DocumentMetadata {
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
  documentTypeLabel?: string;
  signedUrl?: string;
}

export interface UploadResponse {
  success: boolean;
  data?: DocumentMetadata;
  message?: string;
  error?: string;
}

export interface DocumentTypesResponse {
  success: boolean;
  data?: {
    entityType: string;
    availableTypes: DocumentType[];
    requiredTypes: string[];
  };
  error?: string;
}

class DocumentService {
  /**
   * Get available document types for an entity
   */
  async getDocumentTypes(entityType: string): Promise<DocumentTypesResponse> {
    try {
      const response = await apiService.request<DocumentTypesResponse>(
        `/documents/types/${entityType}`,
        'GET'
      );
      return response;
    } catch (error) {
      console.error('Error getting document types:', error);
      return {
        success: false,
        error: 'Erro ao buscar tipos de documento'
      };
    }
  }

  /**
   * Upload a general document
   */
  async uploadDocument(
    file: File,
    entityType: string,
    entityId: string,
    documentType: string
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);
      formData.append('documentType', documentType);

      const response = await apiService.requestWithFormData<UploadResponse>(
        '/documents/upload',
        'POST',
        formData
      );

      return response;
    } catch (error) {
      console.error('Error uploading document:', error);
      return {
        success: false,
        error: 'Erro ao enviar documento'
      };
    }
  }

  /**
   * Replace an existing document
   */
  async replaceDocument(
    file: File,
    entityType: string,
    entityId: string,
    documentType: string
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);
      formData.append('documentType', documentType);

      const response = await apiService.requestWithFormData<UploadResponse>(
        '/documents/replace',
        'PUT',
        formData
      );

      return response;
    } catch (error) {
      console.error('Error replacing document:', error);
      return {
        success: false,
        error: 'Erro ao substituir documento'
      };
    }
  }

  /**
   * Get documents for an entity
   */
  async getEntityDocuments(
    entityType: string,
    entityId: string,
    documentType?: string
  ): Promise<{ success: boolean; data?: DocumentMetadata[]; error?: string }> {
    try {
      const url = documentType 
        ? `/documents/entity/${entityType}/${entityId}?documentType=${documentType}`
        : `/documents/entity/${entityType}/${entityId}`;

      const response = await apiService.request<{ success: boolean; data: DocumentMetadata[] }>(
        url,
        'GET'
      );

      return response;
    } catch (error) {
      console.error('Error getting entity documents:', error);
      return {
        success: false,
        error: 'Erro ao buscar documentos'
      };
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<{ success: boolean; data?: DocumentMetadata; error?: string }> {
    try {
      const response = await apiService.request<{ success: boolean; data: DocumentMetadata }>(
        `/documents/${documentId}`,
        'GET'
      );

      return response;
    } catch (error) {
      console.error('Error getting document:', error);
      return {
        success: false,
        error: 'Erro ao buscar documento'
      };
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await apiService.request<{ success: boolean; message?: string }>(
        `/documents/${documentId}`,
        'DELETE'
      );

      return response;
    } catch (error) {
      console.error('Error deleting document:', error);
      return {
        success: false,
        error: 'Erro ao excluir documento'
      };
    }
  }

  /**
   * Upload CNH for driver
   */
  async uploadDriverCNH(driverId: string, file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiService.requestWithFormData<UploadResponse>(
        `/drivers/${driverId}/upload-cnh`,
        'POST',
        formData
      );

      return response;
    } catch (error) {
      console.error('Error uploading CNH:', error);
      return {
        success: false,
        error: 'Erro ao enviar CNH'
      };
    }
  }

  /**
   * Upload internal terms for driver
   */
  async uploadDriverTerms(driverId: string, file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiService.requestWithFormData<UploadResponse>(
        `/drivers/${driverId}/upload-terms`,
        'POST',
        formData
      );

      return response;
    } catch (error) {
      console.error('Error uploading terms:', error);
      return {
        success: false,
        error: 'Erro ao enviar termo de normas internas'
      };
    }
  }

  /**
   * Get driver documents
   */
  async getDriverDocuments(driverId: string): Promise<{ success: boolean; data?: DocumentMetadata[]; error?: string }> {
    try {
      const response = await apiService.request<{ success: boolean; data: DocumentMetadata[] }>(
        `/drivers/${driverId}/documents`,
        'GET'
      );

      return response;
    } catch (error) {
      console.error('Error getting driver documents:', error);
      return {
        success: false,
        error: 'Erro ao buscar documentos do condutor'
      };
    }
  }

  /**
   * Upload DUT for vehicle
   */
  async uploadVehicleDUT(vehicleId: string, file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiService.requestWithFormData<UploadResponse>(
        `/vehicles/${vehicleId}/upload-dut`,
        'POST',
        formData
      );

      return response;
    } catch (error) {
      console.error('Error uploading DUT:', error);
      return {
        success: false,
        error: 'Erro ao enviar DUT'
      };
    }
  }

  /**
   * Upload vehicle document
   */
  async uploadVehicleDocument(
    vehicleId: string,
    file: File,
    documentType: string
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);

      const response = await apiService.requestWithFormData<UploadResponse>(
        `/vehicles/${vehicleId}/upload-document`,
        'POST',
        formData
      );

      return response;
    } catch (error) {
      console.error('Error uploading vehicle document:', error);
      return {
        success: false,
        error: 'Erro ao enviar documento do veículo'
      };
    }
  }

  /**
   * Get vehicle documents
   */
  async getVehicleDocuments(vehicleId: string): Promise<{ success: boolean; data?: DocumentMetadata[]; error?: string }> {
    try {
      const response = await apiService.request<{ success: boolean; data: DocumentMetadata[] }>(
        `/vehicles/${vehicleId}/documents`,
        'GET'
      );

      return response;
    } catch (error) {
      console.error('Error getting vehicle documents:', error);
      return {
        success: false,
        error: 'Erro ao buscar documentos do veículo'
      };
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file type icon based on MIME type
   */
  getFileTypeIcon(mimeType: string): string {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    return '📁';
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'Arquivo muito grande. Tamanho máximo: 10MB'
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Tipo de arquivo não permitido. Formatos aceitos: PDF, JPG, PNG'
      };
    }

    return { isValid: true };
  }
}

export const documentService = new DocumentService();