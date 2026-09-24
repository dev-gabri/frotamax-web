import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Tab,
  Tabs,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add,
  Assignment,
  FilterList,
  Refresh,
  CarRental,
  Person,
  Schedule
} from '@mui/icons-material';
import { VehicleAssignment, Driver, Vehicle, AssignmentRequest } from '../types';
import { apiService } from '../services/apiService';
import AssignmentForm from '../components/AssignmentForm';
import AssignmentCard from '../components/AssignmentCard';
import AssignmentHistory from '../components/AssignmentHistory';

const AssignmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<VehicleAssignment | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<VehicleAssignment | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    assignment_type: '',
    status: '',
    vehicle_id: '',
    driver_id: '',
    include_terminated: false
  });

  useEffect(() => {
    loadData();
    loadDriversAndVehicles();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
      
      const response = await apiService.get(`/assignments?${queryParams}`);
      
      // Handle different response structures
      let assignmentsData = [];
      if (response.data) {
        assignmentsData = Array.isArray(response.data) ? response.data : (response.data as any).data || [];
      }
      
      setAssignments(assignmentsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load assignments');
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDriversAndVehicles = async () => {
    try {
      const [driversResponse, vehiclesResponse] = await Promise.all([
        apiService.get('/drivers'),
        apiService.get('/vehicles')
      ]);
      
      // Handle different response structures
      let driversData = [];
      let vehiclesData = [];
      
      if (driversResponse.data) {
        driversData = Array.isArray(driversResponse.data) ? driversResponse.data : (driversResponse.data as any).data || [];
      }
      
      if (vehiclesResponse.data) {
        vehiclesData = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : (vehiclesResponse.data as any).data || [];
      }
      
      setDrivers(driversData);
      setVehicles(vehiclesData);
    } catch (err) {
      console.error('Error loading drivers and vehicles:', err);
    }
  };

  const handleCreateAssignment = async (assignmentData: AssignmentRequest) => {
    try {
      await apiService.post('/assignments', assignmentData);
      setShowForm(false);
      loadData();
    } catch (err: any) {
      console.error('Error creating assignment:', err);
      console.error('Error response:', err.response?.data);
      
      // Handle specific error messages
      let errorMessage = 'Falha ao criar atribuição';
      if (err.response?.data?.error) {
        const originalError = err.response.data.error;
        if (originalError.includes('already has a permanent assignment')) {
          errorMessage = 'Este veículo já possui uma atribuição permanente ativa. Para criar uma nova atribuição permanente, termine a atribuição atual primeiro.';
        } else {
          errorMessage = originalError;
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const handleUpdateAssignment = async (id: string, assignmentData: any) => {
    try {
      await apiService.put(`/assignments/${id}`, assignmentData);
      setEditingAssignment(null);
      loadData();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to update assignment');
    }
  };

  const handleTerminateAssignment = async (id: string) => {
    try {
      await apiService.delete(`/assignments/${id}`);
      loadData();
    } catch (err: any) {
      console.error('Error terminating assignment:', err);
    }
  };

  const renderFilters = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <FilterList sx={{ mr: 1 }} />
          Filtros
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Atribuição</InputLabel>
              <Select
                value={filters.assignment_type}
                label="Tipo de Atribuição"
                onChange={(e) => setFilters(prev => ({ ...prev, assignment_type: e.target.value }))}
              >
                <MenuItem value="">Todos os Tipos</MenuItem>
                <MenuItem value="permanent">Permanente</MenuItem>
                <MenuItem value="temporary">Temporária</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <MenuItem value="">Todos os Status</MenuItem>
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
                <MenuItem value="terminated">Terminado</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Veículo</InputLabel>
              <Select
                value={filters.vehicle_id}
                label="Veículo"
                onChange={(e) => setFilters(prev => ({ ...prev, vehicle_id: e.target.value }))}
              >
                <MenuItem value="">Todos os Veículos</MenuItem>
                {vehicles.map(vehicle => (
                  <MenuItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Condutor</InputLabel>
              <Select
                value={filters.driver_id}
                label="Condutor"
                onChange={(e) => setFilters(prev => ({ ...prev, driver_id: e.target.value }))}
              >
                <MenuItem value="">Todos os Condutores</MenuItem>
                {drivers.map(driver => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.include_terminated}
                  onChange={(e) => setFilters(prev => ({ ...prev, include_terminated: e.target.checked }))}
                />
              }
              label="Incluir atribuições terminadas"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAssignmentsList = () => (
    <Box>
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center" color="text.secondary">
              Nenhuma atribuição encontrada
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
              Crie sua primeira atribuição para começar
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {assignments.map((assignment) => (
            <Grid item xs={12} md={6} lg={4} key={assignment.id}>
              <AssignmentCard
                assignment={assignment}
                onEdit={(assignment) => setEditingAssignment(assignment)}
                onTerminate={(id) => handleTerminateAssignment(id)}
                onViewHistory={(assignment) => {
                  setSelectedAssignment(assignment);
                  setShowHistory(true);
                }}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  const renderStatistics = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Assignment color="primary" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h4" color="primary">
                  {assignments.filter(a => a.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Atribuições Ativas
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <CarRental color="success" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h4" color="success.main">
                  {assignments.filter(a => a.assignment_type === 'permanent' && a.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Atribuições Permanentes
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Schedule color="warning" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h4" color="warning.main">
                  {assignments.filter(a => a.assignment_type === 'temporary' && a.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Atribuições Temporárias
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <Person color="info" sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h4" color="info.main">
                  {new Set(assignments.filter(a => a.status === 'active').map(a => a.driver_id)).size}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Condutores Atribuídos
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Atribuições de Veículos</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
            sx={{ mr: 1 }}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowForm(true)}
          >
            Nova Atribuição
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Todas as Atribuições" />
        <Tab label="Estatísticas" />
      </Tabs>

      {activeTab === 0 && (
        <>
          {renderFilters()}
          {renderAssignmentsList()}
        </>
      )}

      {activeTab === 1 && (
        <>
          {renderStatistics()}
          {renderAssignmentsList()}
        </>
      )}

      {/* Assignment Form Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criar Nova Atribuição</DialogTitle>
        <DialogContent>
          <AssignmentForm
            onSubmit={handleCreateAssignment}
            onCancel={() => setShowForm(false)}
            drivers={drivers}
            vehicles={vehicles}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={!!editingAssignment} onClose={() => setEditingAssignment(null)} maxWidth="md" fullWidth>
        <DialogTitle>Editar Atribuição</DialogTitle>
        <DialogContent>
          {editingAssignment && (
            <AssignmentForm
              assignment={editingAssignment}
              onSubmit={(data) => handleUpdateAssignment(editingAssignment.id, data)}
              onCancel={() => setEditingAssignment(null)}
              drivers={drivers}
              vehicles={vehicles}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Assignment History Dialog */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>Histórico de Atribuições</DialogTitle>
        <DialogContent>
          {selectedAssignment && (
            <AssignmentHistory assignmentId={selectedAssignment.id} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssignmentsPage;