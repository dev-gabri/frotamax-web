import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Badge,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Description,
  CheckCircle
} from '@mui/icons-material';
import { DocumentViewer } from './DocumentViewer';
import { FileUpload } from './FileUpload';
import { DocumentMetadata, DocumentType, documentService } from '../services/documentService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`document-tabpanel-${index}`}
      aria-labelledby={`document-tab-${index}`}
      sx={{ pt: 3 }}
    >
      {value === index && children}
    </Box>
  );
}

interface DocumentManagerProps {
  entityType: 'driver' | 'vehicle' | 'user';
  entityId: string;
  allowUpload?: boolean;
  allowDelete?: boolean;
  allowDownload?: boolean;
  onDocumentChange?: (documents: DocumentMetadata[]) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  entityType,
  entityId,
  allowUpload = true,
  allowDelete = true,
  allowDownload = true,
  onDocumentChange: _onDocumentChange
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [requiredTypes, setRequiredTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (entityType && entityId) {
      loadData();
    }
  }, [entityType, entityId]);

  const loadData = async () => {
    if (isLoadingData) return; // Prevent multiple simultaneous calls
    
    setIsLoadingData(true);
    setLoading(true);
    try {
      // Load documents
      const documentsResponse = await documentService.getEntityDocuments(entityType, entityId);
      if (documentsResponse.success && documentsResponse.data) {
        setDocuments(documentsResponse.data);
        // Only call onDocumentChange if documents have actually changed
        // This prevents infinite loops during initial load
      }

      // Load document types
      const typesResponse = await documentService.getDocumentTypes(entityType);
      if (typesResponse.success && typesResponse.data) {
        setDocumentTypes(typesResponse.data.availableTypes);
        setRequiredTypes(typesResponse.data.requiredTypes);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };

  const getDocumentsByCategory = () => {
    const allDocs = documents.filter(doc => doc.is_active);
    const requiredDocs = allDocs.filter(doc => requiredTypes.includes(doc.document_type));
    const optionalDocs = allDocs.filter(doc => !requiredTypes.includes(doc.document_type));
    
    return { allDocs, requiredDocs, optionalDocs };
  };

  const getMissingRequiredDocuments = () => {
    const existingTypes = documents
      .filter(doc => doc.is_active)
      .map(doc => doc.document_type);
    
    return requiredTypes.filter(type => !existingTypes.includes(type));
  };

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    setSelectedDocumentType('');
    loadData();
  };

  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const getUploadFunction = (documentType: string) => {
    return async (file: File) => {
      if (entityType === 'driver') {
        if (documentType === 'cnh') {
          return await documentService.uploadDriverCNH(entityId, file);
        } else if (documentType === 'internal_terms') {
          return await documentService.uploadDriverTerms(entityId, file);
        }
      } else if (entityType === 'vehicle') {
        if (documentType === 'dut') {
          return await documentService.uploadVehicleDUT(entityId, file);
        } else {
          return await documentService.uploadVehicleDocument(entityId, file, documentType);
        }
      }
      
      return await documentService.uploadDocument(file, entityType, entityId, documentType);
    };
  };

  const { allDocs, requiredDocs, optionalDocs } = getDocumentsByCategory();
  const missingRequiredDocs = getMissingRequiredDocuments();
  const hasRequiredDocuments = requiredTypes.length > 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Missing Required Documents Alert */}
      {missingRequiredDocs.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Documentos obrigatórios em falta:</strong>
          </Typography>
          <Typography variant="body2">
            {missingRequiredDocs.map(type => {
              const docType = documentTypes.find(dt => dt.type === type);
              return docType?.label || type;
            }).join(', ')}
          </Typography>
        </Alert>
      )}

      {/* Document Status Summary */}
      {hasRequiredDocuments && (
        <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Status dos Documentos
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" />
              <Typography variant="body2">
                Obrigatórios: {requiredTypes.length - missingRequiredDocs.length}/{requiredTypes.length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description color="primary" />
              <Typography variant="body2">
                Total: {allDocs.length}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab
            label={
              <Badge badgeContent={allDocs.length} color="primary">
                Todos os documentos
              </Badge>
            }
          />
          
          {hasRequiredDocuments && (
            <Tab
              label={
                <Badge
                  badgeContent={missingRequiredDocs.length}
                  color="error"
                  showZero={false}
                >
                  <Badge badgeContent={requiredDocs.length} color="success">
                    Obrigatórios
                  </Badge>
                </Badge>
              }
            />
          )}
          
          {optionalDocs.length > 0 && (
            <Tab
              label={
                <Badge badgeContent={optionalDocs.length} color="info">
                  Opcionais
                </Badge>
              }
            />
          )}
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={currentTab} index={0}>
        <DocumentViewer
          documents={allDocs}
          onDocumentUpdate={loadData}
          showUploadButton={allowUpload}
          onUploadClick={handleUploadClick}
          entityType={entityType}
          entityId={entityId}
          allowDelete={allowDelete}
          allowDownload={allowDownload}
        />
      </TabPanel>

      {hasRequiredDocuments && (
        <TabPanel value={currentTab} index={1}>
          {missingRequiredDocs.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                {missingRequiredDocs.length} documento(s) obrigatório(s) em falta
              </Typography>
            </Alert>
          )}
          <DocumentViewer
            documents={requiredDocs}
            onDocumentUpdate={loadData}
            showUploadButton={allowUpload && missingRequiredDocs.length > 0}
            onUploadClick={handleUploadClick}
            entityType={entityType}
            entityId={entityId}
            allowDelete={allowDelete}
            allowDownload={allowDownload}
          />
        </TabPanel>
      )}

      {optionalDocs.length > 0 && (
        <TabPanel value={currentTab} index={hasRequiredDocuments ? 2 : 1}>
          <DocumentViewer
            documents={optionalDocs}
            onDocumentUpdate={loadData}
            showUploadButton={allowUpload}
            onUploadClick={handleUploadClick}
            entityType={entityType}
            entityId={entityId}
            allowDelete={allowDelete}
            allowDownload={allowDownload}
          />
        </TabPanel>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Enviar documento
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo de documento</InputLabel>
              <Select
                value={selectedDocumentType}
                onChange={(e) => setSelectedDocumentType(e.target.value)}
                label="Tipo de documento"
              >
                {documentTypes.map((type) => (
                  <MenuItem key={type.type} value={type.type}>
                    {type.label}
                    {type.required && (
                      <Typography
                        component="span"
                        color="error"
                        sx={{ ml: 1, fontSize: '0.8em' }}
                      >
                        (Obrigatório)
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {selectedDocumentType && (
            <FileUpload
              uploadFunction={getUploadFunction(selectedDocumentType)}
              onUploadSuccess={handleUploadSuccess}
              label="Arrastar arquivo ou clicar para selecionar"
              helperText="Formatos aceitos: PDF, JPG, PNG (máx. 10MB)"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};