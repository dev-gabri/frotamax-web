import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Avatar,
  Divider
} from '@mui/material';
import {
  MoreVert,
  Edit,
  History,
  Cancel,
  CarRental,
  Person,
  DateRange,
  AccessTime,
  Notes
} from '@mui/icons-material';
import { VehicleAssignment } from '../types';
import { format } from 'date-fns';

interface AssignmentCardProps {
  assignment: VehicleAssignment;
  onEdit: (assignment: VehicleAssignment) => void;
  onTerminate: (id: string, reason?: string) => void;
  onViewHistory: (assignment: VehicleAssignment) => void;
}

const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  onEdit,
  onTerminate,
  onViewHistory
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleTerminate = () => {
    onTerminate(assignment.id, terminateReason);
    setShowTerminateDialog(false);
    setTerminateReason('');
    handleMenuClose();
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'terminated': return 'error';
      default: return 'default';
    }
  };

  const getAssignmentTypeColor = (type: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    return type === 'permanent' ? 'primary' : 'secondary';
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const translateAssignmentType = (type: string) => {
    switch (type) {
      case 'permanent': return 'Permanente';
      case 'temporary': return 'Temporária';
      default: return type;
    }
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'terminated': return 'Terminado';
      default: return status;
    }
  };

  const getAssignmentDuration = () => {
    if (assignment.assignment_type === 'permanent') {
      return 'Permanente';
    }
    
    if (assignment.end_date) {
      const start = new Date(assignment.start_date);
      const end = new Date(assignment.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} dias`;
    }
    
    return 'Não especificado';
  };

  const isExpired = () => {
    if (assignment.assignment_type === 'permanent') return false;
    if (!assignment.end_date) return false;
    return new Date(assignment.end_date) < new Date();
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={translateAssignmentType(assignment.assignment_type)}
                color={getAssignmentTypeColor(assignment.assignment_type)}
                size="small"
                sx={{ mr: 1 }}
              />
              <Chip
                label={translateStatus(assignment.status)}
                color={getStatusColor(assignment.status)}
                size="small"
              />
            </Box>
            <IconButton size="small" onClick={handleMenuClick}>
              <MoreVert />
            </IconButton>
          </Box>

          {/* Vehicle Information */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
              <CarRental />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                {assignment.vehicle?.license_plate || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {assignment.vehicle?.brand} {assignment.vehicle?.model}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Driver Information */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                {assignment.driver?.full_name || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {assignment.driver?.cpf || 'N/A'}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Assignment Details */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <DateRange sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                Início: {formatDate(assignment.start_date)}
              </Typography>
            </Box>
            
            {assignment.end_date && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DateRange sx={{ mr: 1, fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  Fim: {formatDate(assignment.end_date)}
                  {isExpired() && (
                    <Chip
                      label="Expirado"
                      color="error"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AccessTime sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                Duração: {getAssignmentDuration()}
              </Typography>
            </Box>
          </Box>

          {/* Notes */}
          {assignment.notes && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                <Notes sx={{ mr: 1, fontSize: 16, mt: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  {assignment.notes}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Assignment Info */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Criado: {formatDate(assignment.created_at)}
            </Typography>
            {assignment.assigned_by_user && (
              <Typography variant="caption" color="text.secondary" display="block">
                Por: {assignment.assigned_by_user.email}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onEdit(assignment); handleMenuClose(); }}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => { onViewHistory(assignment); handleMenuClose(); }}>
          <ListItemIcon>
            <History fontSize="small" />
          </ListItemIcon>
          <ListItemText>Ver Histórico</ListItemText>
        </MenuItem>
        
        {assignment.status === 'active' && (
          <MenuItem onClick={() => { setShowTerminateDialog(true); handleMenuClose(); }}>
            <ListItemIcon>
              <Cancel fontSize="small" />
            </ListItemIcon>
            <ListItemText>Terminar</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Terminate Dialog */}
      <Dialog open={showTerminateDialog} onClose={() => setShowTerminateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Terminar Atribuição</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Tem certeza que deseja terminar esta atribuição?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Veículo: {assignment.vehicle?.license_plate} - {assignment.vehicle?.brand} {assignment.vehicle?.model}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Condutor: {assignment.driver?.full_name}
          </Typography>
          
          <TextField
            fullWidth
            label="Motivo da terminação (opcional)"
            multiline
            rows={3}
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Digite o motivo para terminar esta atribuição..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTerminateDialog(false)}>Cancelar</Button>
          <Button onClick={handleTerminate} color="error" variant="contained">
            Terminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssignmentCard;