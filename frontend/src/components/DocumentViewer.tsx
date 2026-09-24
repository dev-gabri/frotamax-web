import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Download,
  Delete,
  Visibility,
  MoreVert,
  Description,
  Image,
  PictureAsPdf,
  CheckCircle,
  Error as ErrorIcon,
  CloudUpload
} from '@mui/icons-material';
import { DocumentMetadata, documentService } from '../services/documentService';

interface DocumentViewerProps {
  documents: DocumentMetadata[];
  onDocumentUpdate?: () => void;
  showUploadButton?: boolean;
  onUploadClick?: () => void;
  entityType?: string;
  entityId?: string;
  allowDelete?: boolean;
  allowDownload?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

interface DocumentCardProps {
  document: DocumentMetadata;
  onUpdate?: () => void;
  allowDelete?: boolean;
  allowDownload?: boolean;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onUpdate,
  allowDelete = true,
  allowDownload = true
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDownload = () => {
    if (document.signedUrl) {
      const link = window.document.createElement('a');
      link.href = document.signedUrl;
      link.download = document.file_name;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
    handleMenuClose();
  };

  const handlePreview = () => {
    setPreviewDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await documentService.deleteDocument(document.id);
      if (response.success) {
        onUpdate?.();
      } else {
        console.error('Erro ao excluir documento:', response.error);
      }
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) {
      return <PictureAsPdf color="error" />;
    } else if (mimeType.includes('image')) {
      return <Image color="primary" />;
    }
    return <Description color="action" />;
  };

  const getFileTypeColor = (mimeType: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    if (mimeType.includes('pdf')) return 'error';
    if (mimeType.includes('image')) return 'primary';
    return 'default';
  };

  const getFileTypeLabel = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'JPG';
    if (mimeType.includes('png')) return 'PNG';
    return 'Arquivo';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canPreview = document.mime_type.includes('image') || document.mime_type.includes('pdf');

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0, pr: 1 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                  maxHeight: '2.4em'
                }}
                title={document.file_name}
              >
                {document.file_name}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {document.documentTypeLabel || document.document_type}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Chip
                label={getFileTypeLabel(document.mime_type)}
                color={getFileTypeColor(document.mime_type)}
                size="small"
                icon={getFileIcon(document.mime_type)}
                sx={{ 
                  minWidth: 'auto',
                  '& .MuiChip-label': { 
                    px: 1,
                    fontSize: '0.75rem'
                  }
                }}
              />
              
              <IconButton 
                size="small" 
                onClick={handleMenuClick}
                sx={{ 
                  p: 0.5,
                  minWidth: 'auto',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Tamanho:</strong> {documentService.formatFileSize(document.file_size)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Enviado em:</strong> {formatDate(document.created_at)}
            </Typography>
            {document.updated_at !== document.created_at && (
              <Typography variant="body2" color="text.secondary">
                <strong>Atualizado em:</strong> {formatDate(document.updated_at)}
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            {document.is_active ? (
              <Chip
                label="Ativo"
                color="success"
                size="small"
                icon={<CheckCircle />}
              />
            ) : (
              <Chip
                label="Inativo"
                color="default"
                size="small"
                icon={<ErrorIcon />}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {canPreview && (
          <MenuItem onClick={handlePreview}>
            <ListItemIcon>
              <Visibility />
            </ListItemIcon>
            <ListItemText>Visualizar</ListItemText>
          </MenuItem>
        )}
        
        {allowDownload && document.signedUrl && (
          <MenuItem onClick={handleDownload}>
            <ListItemIcon>
              <Download />
            </ListItemIcon>
            <ListItemText>Baixar</ListItemText>
          </MenuItem>
        )}
        
        {allowDelete && (
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete color="error" />
            </ListItemIcon>
            <ListItemText>Excluir</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Visualizar: {document.file_name}
        </DialogTitle>
        <DialogContent>
          {document.signedUrl && (
            <Box sx={{ textAlign: 'center' }}>
              {document.mime_type.includes('image') ? (
                <img
                  src={document.signedUrl}
                  alt={document.file_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                />
              ) : document.mime_type.includes('pdf') ? (
                <iframe
                  src={document.signedUrl}
                  style={{
                    width: '100%',
                    height: '70vh',
                    border: 'none'
                  }}
                  title={document.file_name}
                />
              ) : (
                <Typography>Visualização não disponível para este tipo de arquivo</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {allowDownload && document.signedUrl && (
            <Button onClick={handleDownload} startIcon={<Download />}>
              Baixar
            </Button>
          )}
          <Button onClick={() => setPreviewDialogOpen(false)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza de que deseja excluir o documento "{document.file_name}"?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : <Delete />}
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documents,
  onDocumentUpdate,
  showUploadButton = false,
  onUploadClick,
  entityType: _entityType,
  entityId: _entityId,
  allowDelete = true,
  allowDownload = true,
  maxWidth: _maxWidth = 'lg'
}) => {
  const [loading] = useState(false);

  const refreshDocuments = () => {
    onDocumentUpdate?.();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Documentos {documents.length > 0 && `(${documents.length})`}
        </Typography>
        
        {showUploadButton && (
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={onUploadClick}
          >
            Enviar documento
          </Button>
        )}
      </Box>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <Alert severity="info" sx={{ textAlign: 'center' }}>
          <Typography variant="body1">
            Nenhum documento encontrado
          </Typography>
          {showUploadButton && (
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={onUploadClick}
              sx={{ mt: 2 }}
            >
              Enviar primeiro documento
            </Button>
          )}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {documents.map((document) => (
            <Grid item xs={12} sm={6} md={4} key={document.id}>
              <DocumentCard
                document={document}
                onUpdate={refreshDocuments}
                allowDelete={allowDelete}
                allowDownload={allowDownload}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};