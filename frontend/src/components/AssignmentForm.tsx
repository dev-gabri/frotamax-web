import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Divider
} from '@mui/material';
import {
  Save,
  Cancel,
  CarRental,
  Person
} from '@mui/icons-material';
import { VehicleAssignment, Driver, Vehicle, AssignmentRequest } from '../types';
import { format } from 'date-fns';

interface AssignmentFormProps {
  assignment?: VehicleAssignment;
  onSubmit: (data: AssignmentRequest) => Promise<void>;
  onCancel: () => void;
  drivers: Driver[];
  vehicles: Vehicle[];
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({
  assignment,
  onSubmit,
  onCancel,
  drivers,
  vehicles
}) => {
  const [formData, setFormData] = useState<AssignmentRequest>({
    vehicle_id: assignment?.vehicle_id || '',
    driver_id: assignment?.driver_id || '',
    assignment_type: assignment?.assignment_type || 'permanent',
    start_date: assignment?.start_date || format(new Date(), 'yyyy-MM-dd'),
    end_date: assignment?.end_date || '',
    notes: assignment?.notes || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    // Filter available vehicles based on assignment type
    let filteredVehicles = vehicles;
    
    // If creating a permanent assignment, exclude vehicles that already have permanent assignments
    if (formData.assignment_type === 'permanent' && !assignment) {
      filteredVehicles = vehicles.filter(vehicle => 
        !vehicle.is_permanently_assigned
      );
    } 
    // If editing an assignment, allow the currently assigned vehicle
    else if (assignment) {
      filteredVehicles = vehicles.filter(vehicle => 
        !vehicle.is_permanently_assigned || vehicle.id === assignment.vehicle_id
      );
    }
    // For temporary assignments, all vehicles are available (even permanently assigned ones)
    
    setAvailableVehicles(filteredVehicles);

    // Filter available drivers (active drivers with valid CNH and signed terms)
    const filteredDrivers = drivers.filter(driver => {
      // Driver must be active
      if (!driver.is_active) return false;
      
      // Check if CNH is not expired (add some tolerance for near-expiry)
      const cnhExpiryDate = new Date(driver.cnh_expiry_date);
      const today = new Date();
      if (cnhExpiryDate < today) return false;
      
      // Check if internal terms are signed
      if (driver.internal_terms_status !== 'signed') return false;
      
      return true;
    });
    setAvailableDrivers(filteredDrivers);
  }, [vehicles, drivers, assignment, formData.assignment_type]);

  const handleChange = (field: keyof AssignmentRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear end date when switching to permanent
    if (field === 'assignment_type' && value === 'permanent') {
      setFormData(prev => ({
        ...prev,
        end_date: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate form data
      if (!formData.vehicle_id || !formData.driver_id || !formData.assignment_type || !formData.start_date) {
        throw new Error('Por favor, preencha todos os campos obrigatórios');
      }

      if (formData.assignment_type === 'temporary' && !formData.end_date) {
        throw new Error('Data de fim é obrigatória para atribuições temporárias');
      }

      if (formData.assignment_type === 'temporary' && formData.end_date) {
        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);
        
        if (endDate <= startDate) {
          throw new Error('Data de fim deve ser posterior à data de início');
        }
      }
      
      // Submit the form
      await onSubmit(formData);
    } catch (err: any) {
      console.error('Error in form submission:', err);
      setError(err.message || 'Ocorreu um erro ao salvar a atribuição');
    } finally {
      setLoading(false);
    }
  };

  const translateVehicleStatus = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'em_uso': return 'Em Uso';
      case 'manutencao': return 'Manutenção';
      case 'indisponivel': return 'Indisponível';
      default: return status;
    }
  };

  const translateDriverStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'signed': return 'Assinado';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  const selectedVehicle = availableVehicles.find(v => v.id === formData.vehicle_id);
  const selectedDriver = availableDrivers.find(d => d.id === formData.driver_id);

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Assignment Type */}
        <Grid item xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Tipo de Atribuição</FormLabel>
            <RadioGroup
              row
              value={formData.assignment_type}
              onChange={(e) => handleChange('assignment_type', e.target.value)}
            >
              <FormControlLabel
                value="permanent"
                control={<Radio />}
                label="Atribuição Permanente"
              />
              <FormControlLabel
                value="temporary"
                control={<Radio />}
                label="Atribuição Temporária"
              />
            </RadioGroup>
          </FormControl>
        </Grid>

        {/* Vehicle Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Veículo</InputLabel>
            <Select
              value={formData.vehicle_id}
              label="Veículo"
              onChange={(e) => handleChange('vehicle_id', e.target.value)}
            >
              {availableVehicles.map(vehicle => (
                <MenuItem key={vehicle.id} value={vehicle.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CarRental sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="body2">
                        {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {vehicle.category} • {vehicle.fuel_type}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Driver Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Condutor</InputLabel>
            <Select
              value={formData.driver_id}
              label="Condutor"
              onChange={(e) => handleChange('driver_id', e.target.value)}
            >
              {availableDrivers.map(driver => (
                <MenuItem key={driver.id} value={driver.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Person sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="body2">
                        {driver.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        CNH: {driver.cnh_category} • {driver.cpf}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Start Date */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            label="Data de Início"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleChange('start_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        {/* End Date (only for temporary assignments) */}
        {formData.assignment_type === 'temporary' && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              required
              label="Data de Fim"
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: formData.start_date
              }}
            />
          </Grid>
        )}

        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Observações (Opcional)"
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Digite observações adicionais sobre esta atribuição..."
          />
        </Grid>

        {/* Preview Cards */}
        {(selectedVehicle || selectedDriver) && (
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Pré-visualização da Atribuição
            </Typography>
            <Grid container spacing={2}>
              {selectedVehicle && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                          <CarRental />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {selectedVehicle.license_plate}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedVehicle.brand} {selectedVehicle.model}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={selectedVehicle.category} size="small" />
                        <Chip label={selectedVehicle.fuel_type} size="small" />
                        <Chip label={translateVehicleStatus(selectedVehicle.status)} size="small" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {selectedDriver && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                          <Person />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {selectedDriver.full_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedDriver.cpf}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={`CNH: ${selectedDriver.cnh_category}`} size="small" />
                        <Chip label={translateDriverStatus(selectedDriver.internal_terms_status)} size="small" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Grid>
        )}
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<Cancel />}
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={<Save />}
          disabled={loading}
        >
          {loading ? 'Salvando...' : assignment ? 'Atualizar Atribuição' : 'Criar Atribuição'}
        </Button>
      </Box>
    </Box>
  );
};

export default AssignmentForm;