import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot
} from '@mui/lab';
import {
  Add,
  Edit,
  Cancel,
  ExpandMore,
  History,
  Person,
  AccessTime
} from '@mui/icons-material';
import { AssignmentHistory as AssignmentHistoryType } from '../types';
import { apiService } from '../services/apiService';
import { format } from 'date-fns';

interface AssignmentHistoryProps {
  assignmentId: string;
}

const AssignmentHistory: React.FC<AssignmentHistoryProps> = ({ assignmentId }) => {
  const [history, setHistory] = useState<AssignmentHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [assignmentId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.get(`/assignments/${assignmentId}/history`);
      setHistory(response.data as AssignmentHistoryType[] || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao carregar histórico de atribuição');
      console.error('Error loading assignment history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Add />;
      case 'modified':
        return <Edit />;
      case 'terminated':
        return <Cancel />;
      default:
        return <History />;
    }
  };

  const getActionColor = (action: string): "primary" | "secondary" | "success" | "error" | "info" | "warning" => {
    switch (action) {
      case 'created':
        return 'success';
      case 'modified':
        return 'info';
      case 'terminated':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return 'Atribuição Criada';
      case 'modified':
        return 'Atribuição Modificada';
      case 'terminated':
        return 'Atribuição Terminada';
      default:
        return 'Ação Desconhecida';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
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

  const translateFieldName = (field: string) => {
    switch (field) {
      case 'assignment_type': return 'Tipo de Atribuição';
      case 'start_date': return 'Data de Início';
      case 'end_date': return 'Data de Fim';
      case 'status': return 'Status';
      case 'notes': return 'Observações';
      default: return field;
    }
  };

  const translateFieldValue = (field: string, value: string) => {
    if (!value) return 'Não definido';
    
    switch (field) {
      case 'assignment_type':
        return translateAssignmentType(value);
      case 'status':
        return translateStatus(value);
      default:
        return value;
    }
  };

  const renderChanges = (oldValues: any, newValues: any) => {
    if (!oldValues || !newValues) return null;

    const changes: string[] = [];
    const relevantFields = ['assignment_type', 'start_date', 'end_date', 'status', 'notes'];

    relevantFields.forEach(field => {
      if (oldValues[field] !== newValues[field]) {
        const oldValue = translateFieldValue(field, oldValues[field]);
        const newValue = translateFieldValue(field, newValues[field]);
        const fieldName = translateFieldName(field);
        changes.push(`${fieldName}: ${oldValue} → ${newValue}`);
      }
    });

    if (changes.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Alterações:
        </Typography>
        {changes.map((change, index) => (
          <Typography key={index} variant="body2" color="text.secondary">
            • {change}
          </Typography>
        ))}
      </Box>
    );
  };

  const renderHistoryItem = (item: AssignmentHistoryType, index: number) => (
    <TimelineItem key={item.id}>
      <TimelineSeparator>
        <TimelineDot color={getActionColor(item.action)}>
          {getActionIcon(item.action)}
        </TimelineDot>
        {index < history.length - 1 && <TimelineConnector />}
      </TimelineSeparator>
      <TimelineContent>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">
                {getActionLabel(item.action)}
              </Typography>
              <Chip
                label={item.action}
                color={getActionColor(item.action)}
                size="small"
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AccessTime sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {formatDate(item.created_at)}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Person sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">
                Por: {item.changed_by_user?.email || 'Desconhecido'}
              </Typography>
            </Box>

            {item.change_reason && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Motivo:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.change_reason}
                </Typography>
              </Box>
            )}

            {item.old_values && item.new_values && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">Ver Alterações</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {renderChanges(item.old_values, item.new_values)}
                </AccordionDetails>
              </Accordion>
            )}

            {item.action === 'created' && item.new_values && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">Ver Valores Iniciais</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Detalhes da Atribuição:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Tipo: {translateAssignmentType(item.new_values.assignment_type)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Data de Início: {item.new_values.start_date}
                    </Typography>
                    {item.new_values.end_date && (
                      <Typography variant="body2" color="text.secondary">
                        • Data de Fim: {item.new_values.end_date}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      • Status: {translateStatus(item.new_values.status)}
                    </Typography>
                    {item.new_values.notes && (
                      <Typography variant="body2" color="text.secondary">
                        • Observações: {item.new_values.notes}
                      </Typography>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </CardContent>
        </Card>
      </TimelineContent>
    </TimelineItem>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <History sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Nenhum histórico disponível
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Esta atribuição não possui histórico registrado
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Histórico de Atribuição
      </Typography>
      
      <Timeline>
        {history.map((item, index) => renderHistoryItem(item, index))}
      </Timeline>
    </Box>
  );
};

export default AssignmentHistory;