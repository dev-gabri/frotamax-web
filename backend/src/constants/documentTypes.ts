export const DOCUMENT_TYPES = {
  // Driver Documents
  DRIVER: {
    CNH: 'cnh',
    INTERNAL_TERMS: 'internal_terms',
    MEDICAL_CERTIFICATE: 'medical_certificate',
    BACKGROUND_CHECK: 'background_check'
  },
  // Vehicle Documents
  VEHICLE: {
    DUT: 'dut',
    INSURANCE: 'insurance',
    REGISTRATION: 'registration',
    MAINTENANCE_RECORD: 'maintenance_record',
    INSPECTION_CERTIFICATE: 'inspection_certificate',
    EMISSION_CERTIFICATE: 'emission_certificate'
  },
  // User Documents
  USER: {
    PROFILE_PICTURE: 'profile_picture',
    GENERAL_DOCUMENT: 'general_document'
  }
} as const;

export const DOCUMENT_TYPE_LABELS = {
  // Driver Documents
  [DOCUMENT_TYPES.DRIVER.CNH]: 'CNH (Carteira Nacional de Habilitação)',
  [DOCUMENT_TYPES.DRIVER.INTERNAL_TERMS]: 'Termo de Normas Internas',
  [DOCUMENT_TYPES.DRIVER.MEDICAL_CERTIFICATE]: 'Atestado Médico',
  [DOCUMENT_TYPES.DRIVER.BACKGROUND_CHECK]: 'Antecedentes Criminais',
  
  // Vehicle Documents
  [DOCUMENT_TYPES.VEHICLE.DUT]: 'DUT (Documento Único de Transferência)',
  [DOCUMENT_TYPES.VEHICLE.INSURANCE]: 'Seguro do Veículo',
  [DOCUMENT_TYPES.VEHICLE.REGISTRATION]: 'Registro do Veículo',
  [DOCUMENT_TYPES.VEHICLE.MAINTENANCE_RECORD]: 'Registro de Manutenção',
  [DOCUMENT_TYPES.VEHICLE.INSPECTION_CERTIFICATE]: 'Certificado de Inspeção',
  [DOCUMENT_TYPES.VEHICLE.EMISSION_CERTIFICATE]: 'Certificado de Emissões',
  
  // User Documents
  [DOCUMENT_TYPES.USER.PROFILE_PICTURE]: 'Foto de Perfil',
  [DOCUMENT_TYPES.USER.GENERAL_DOCUMENT]: 'Documento Geral'
} as const;

export const ENTITY_TYPES = {
  DRIVER: 'driver',
  VEHICLE: 'vehicle',
  USER: 'user'
} as const;

export const REQUIRED_DRIVER_DOCUMENTS = [
  DOCUMENT_TYPES.DRIVER.CNH,
  DOCUMENT_TYPES.DRIVER.INTERNAL_TERMS
] as const;

export const REQUIRED_VEHICLE_DOCUMENTS = [
  DOCUMENT_TYPES.VEHICLE.DUT
] as const;

export const DOCUMENT_CATEGORIES = {
  DRIVER: {
    label: 'Documentos do Condutor',
    types: Object.values(DOCUMENT_TYPES.DRIVER)
  },
  VEHICLE: {
    label: 'Documentos do Veículo',
    types: Object.values(DOCUMENT_TYPES.VEHICLE)
  },
  USER: {
    label: 'Documentos do Usuário',
    types: Object.values(DOCUMENT_TYPES.USER)
  }
} as const;

/**
 * Validate if a document type is valid for an entity type
 */
export function isValidDocumentType(entityType: string, documentType: string): boolean {
  switch (entityType) {
    case ENTITY_TYPES.DRIVER:
      return Object.values(DOCUMENT_TYPES.DRIVER).includes(documentType as any);
    case ENTITY_TYPES.VEHICLE:
      return Object.values(DOCUMENT_TYPES.VEHICLE).includes(documentType as any);
    case ENTITY_TYPES.USER:
      return Object.values(DOCUMENT_TYPES.USER).includes(documentType as any);
    default:
      return false;
  }
}

/**
 * Get document type label
 */
export function getDocumentTypeLabel(documentType: string): string {
  return DOCUMENT_TYPE_LABELS[documentType as keyof typeof DOCUMENT_TYPE_LABELS] || documentType;
}

/**
 * Get required documents for an entity type
 */
export function getRequiredDocuments(entityType: string): string[] {
  switch (entityType) {
    case ENTITY_TYPES.DRIVER:
      return [...REQUIRED_DRIVER_DOCUMENTS];
    case ENTITY_TYPES.VEHICLE:
      return [...REQUIRED_VEHICLE_DOCUMENTS];
    case ENTITY_TYPES.USER:
      return [];
    default:
      return [];
  }
}

/**
 * Get available document types for an entity type
 */
export function getAvailableDocumentTypes(entityType: string): string[] {
  switch (entityType) {
    case ENTITY_TYPES.DRIVER:
      return Object.values(DOCUMENT_TYPES.DRIVER);
    case ENTITY_TYPES.VEHICLE:
      return Object.values(DOCUMENT_TYPES.VEHICLE);
    case ENTITY_TYPES.USER:
      return Object.values(DOCUMENT_TYPES.USER);
    default:
      return [];
  }
}

/**
 * Check if a document type is required for an entity
 */
export function isRequiredDocument(entityType: string, documentType: string): boolean {
  const requiredDocs = getRequiredDocuments(entityType);
  return requiredDocs.includes(documentType);
}

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES][keyof typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES]];
export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];