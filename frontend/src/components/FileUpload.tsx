import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  Snackbar
} from '@mui/material';
import {
  CloudUpload,
  AttachFile,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { documentService } from '../services/documentService';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  onUploadSuccess?: (file: File, response: any) => void;
  onUploadError?: (file: File, error: string) => void;
  disabled?: boolean;
  variant?: 'standard' | 'outlined' | 'contained';
  entityType?: string;
  entityId?: string;
  documentType?: string;
  uploadFunction?: (file: File) => Promise<any>;
  label?: string;
  helperText?: string;
}

interface FileUploadState {
  isDragActive: boolean;
  isUploading: boolean;
  uploadProgress: number;
  selectedFiles: File[];
  uploadResults: Array<{
    file: File;
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = '.pdf,.jpg,.jpeg,.png',
  multiple = false,
  maxSize: _maxSize = 10,
  onUploadSuccess,
  onUploadError,
  disabled = false,
  variant = 'outlined',
  entityType,
  entityId,
  documentType,
  uploadFunction,
  label = 'Selecionar arquivo',
  helperText = 'Formatos aceitos: PDF, JPG, PNG (máx. 10MB)'
}) => {
  const [state, setState] = useState<FileUploadState>({
    isDragActive: false,
    isUploading: false,
    uploadProgress: 0,
    selectedFiles: [],
    uploadResults: []
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setState(prev => ({ ...prev, isDragActive: true }));
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragActive: false }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragActive: false }));

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      const validation = documentService.validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (errors.length > 0) {
      showSnackbar(errors.join('; '), 'error');
    }

    if (validFiles.length > 0) {
      if (!multiple) {
        setState(prev => ({ ...prev, selectedFiles: [validFiles[0]] }));
      } else {
        setState(prev => ({ ...prev, selectedFiles: [...prev.selectedFiles, ...validFiles] }));
      }
    }
  };

  const removeFile = (index: number) => {
    setState(prev => ({
      ...prev,
      selectedFiles: prev.selectedFiles.filter((_, i) => i !== index)
    }));
  };

  const handleUpload = async () => {
    if (state.selectedFiles.length === 0) {
      showSnackbar('Nenhum arquivo selecionado', 'warning');
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0, uploadResults: [] }));

    const results: Array<{
      file: File;
      success: boolean;
      message?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < state.selectedFiles.length; i++) {
      const file = state.selectedFiles[i];
      setState(prev => ({ ...prev, uploadProgress: (i / state.selectedFiles.length) * 100 }));

      try {
        let response;

        if (uploadFunction) {
          response = await uploadFunction(file);
        } else if (entityType && entityId && documentType) {
          response = await documentService.uploadDocument(file, entityType, entityId, documentType);
        } else {
          throw new Error('Configuração de upload inválida');
        }

        if (response.success) {
          results.push({
            file,
            success: true,
            message: response.message || 'Upload realizado com sucesso'
          });
          onUploadSuccess?.(file, response);
        } else {
          results.push({
            file,
            success: false,
            error: response.error || 'Erro no upload'
          });
          onUploadError?.(file, response.error || 'Erro no upload');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        results.push({
          file,
          success: false,
          error: errorMessage
        });
        onUploadError?.(file, errorMessage);
      }
    }

    setState(prev => ({
      ...prev,
      isUploading: false,
      uploadProgress: 100,
      uploadResults: results,
      selectedFiles: []
    }));

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Show summary
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    if (successCount > 0 && errorCount === 0) {
      showSnackbar(`${successCount} arquivo(s) enviado(s) com sucesso`, 'success');
    } else if (successCount > 0 && errorCount > 0) {
      showSnackbar(`${successCount} sucesso(s), ${errorCount} erro(s)`, 'warning');
    } else {
      showSnackbar(`Erro ao enviar ${errorCount} arquivo(s)`, 'error');
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'contained':
        return {
          backgroundColor: state.isDragActive ? 'primary.light' : 'background.paper',
          border: '2px dashed',
          borderColor: state.isDragActive ? 'primary.main' : 'grey.300'
        };
      case 'outlined':
        return {
          border: '2px dashed',
          borderColor: state.isDragActive ? 'primary.main' : 'grey.300',
          backgroundColor: state.isDragActive ? 'action.hover' : 'transparent'
        };
      default:
        return {
          border: '1px solid',
          borderColor: 'grey.300',
          backgroundColor: state.isDragActive ? 'action.hover' : 'background.paper'
        };
    }
  };

  return (
    <Box>
      <Paper
        elevation={variant === 'contained' ? 1 : 0}
        sx={{
          p: 3,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease-in-out',
          ...getVariantStyles(),
          '&:hover': {
            borderColor: disabled ? undefined : 'primary.main',
            backgroundColor: disabled ? undefined : 'action.hover'
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <CloudUpload
          sx={{
            fontSize: 48,
            color: state.isDragActive ? 'primary.main' : 'grey.400',
            mb: 2
          }}
        />

        <Typography variant="h6" gutterBottom>
          {state.isDragActive ? 'Solte os arquivos aqui' : label}
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {helperText}
        </Typography>

        <Button
          variant="outlined"
          startIcon={<AttachFile />}
          disabled={disabled}
          sx={{ mt: 1 }}
        >
          Escolher arquivos
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled}
        />
      </Paper>

      {/* Selected Files */}
      {state.selectedFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Arquivos selecionados:
          </Typography>
          {state.selectedFiles.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              label={`${file.name} (${documentService.formatFileSize(file.size)})`}
              onDelete={() => removeFile(index)}
              icon={<AttachFile />}
              variant="outlined"
              sx={{ m: 0.5 }}
            />
          ))}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={disabled || state.isUploading}
              startIcon={<CloudUpload />}
            >
              {state.isUploading ? 'Enviando...' : 'Enviar arquivos'}
            </Button>
          </Box>
        </Box>
      )}

      {/* Upload Progress */}
      {state.isUploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Enviando arquivos...
          </Typography>
          <LinearProgress variant="determinate" value={state.uploadProgress} />
        </Box>
      )}

      {/* Upload Results */}
      {state.uploadResults.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {state.uploadResults.map((result, index) => (
            <Alert
              key={index}
              severity={result.success ? 'success' : 'error'}
              icon={result.success ? <CheckCircle /> : <ErrorIcon />}
              sx={{ mt: 1 }}
            >
              <strong>{result.file.name}:</strong>{' '}
              {result.success ? result.message : result.error}
            </Alert>
          ))}
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};