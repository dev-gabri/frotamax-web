import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Search,
  DirectionsCar,
  Edit,
  Delete,
  Visibility,
  CheckCircle,
  Refresh,
  Description,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
// import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Vehicle, ApiResponse, VehicleAssignment } from '../types';
import { DocumentManager } from '../components/DocumentManager';
import { AssignmentService } from '../services/assignmentService';

const VehiclesPage: React.FC = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<Map<string, VehicleAssignment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  const [dialogTab, setDialogTab] = useState(0);

  const [formData, setFormData] = useState({
    license_plate: '',
    chassis_number: '',
    renavam: '',
    internal_code: '',
    brand: '',
    model: '',
    manufacture_year: new Date().getFullYear(),
    model_year: new Date().getFullYear(),
    category: '',
    fuel_type: 'flex',
    responsible_department: '',
    cost_center: '',
    base_city: '',
    acquisition_value: '',
    acquisition_date: null as Date | null,
    warranty_supplier: '',
    warranty_period_months: '',
    warranty_special_conditions: '',
    warranty_covered_items: '',
    status: 'disponivel'
  });

  const canManageVehicles = user?.role === 'admin' || user?.role === 'gestor_frota';
  const canDeleteVehicles = user?.role === 'admin';

  useEffect(() => {
    loadVehicles();
    loadVehicleAssignments();
  }, []);

  const loadVehicleAssignments = async () => {
    try {
      const assignments = await AssignmentService.getAssignments({ status: 'active' });
      const assignmentMap = new Map<string, VehicleAssignment>();
      
      if (assignments && (assignments as any).data) {
        ((assignments as any).data as VehicleAssignment[]).forEach((assignment: VehicleAssignment) => {
          if (assignment.status === 'active') {
            assignmentMap.set(assignment.vehicle_id, assignment);
          }
        });
      }
      
      setVehicleAssignments(assignmentMap);
    } catch (error) {
      console.error('Error loading vehicle assignments:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<Vehicle[]>('/vehicles');
      if (response.success) {
        setVehicles(response.data as Vehicle[]);
      } else {
        showSnackbar('Erro ao carregar veículos', 'error');
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
      showSnackbar('Erro ao carregar veículos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (mode: 'create' | 'edit' | 'view', vehicle?: Vehicle) => {
    setDialogMode(mode);
    setSelectedVehicle(vehicle || null);
    
    if (mode === 'create') {
      setFormData({
        license_plate: '',
        chassis_number: '',
        renavam: '',
        internal_code: '',
        brand: '',
        model: '',
        manufacture_year: new Date().getFullYear(),
        model_year: new Date().getFullYear(),
        category: '',
        fuel_type: 'flex',
        responsible_department: '',
        cost_center: '',
        base_city: '',
        acquisition_value: '',
        acquisition_date: null,
        warranty_supplier: '',
        warranty_period_months: '',
        warranty_special_conditions: '',
        warranty_covered_items: '',
        status: 'disponivel'
      });
    } else if (vehicle) {
      setFormData({
        license_plate: vehicle.license_plate,
        chassis_number: vehicle.chassis_number,
        renavam: vehicle.renavam,
        internal_code: vehicle.internal_code || '',
        brand: vehicle.brand,
        model: vehicle.model,
        manufacture_year: vehicle.manufacture_year,
        model_year: vehicle.model_year,
        category: vehicle.category,
        fuel_type: vehicle.fuel_type,
        responsible_department: vehicle.responsible_department,
        cost_center: vehicle.cost_center,
        base_city: vehicle.base_city,
        acquisition_value: vehicle.acquisition_value?.toString() || '',
        acquisition_date: vehicle.acquisition_date ? new Date(vehicle.acquisition_date) : null,
        warranty_supplier: vehicle.warranty_supplier || '',
        warranty_period_months: vehicle.warranty_period_months?.toString() || '',
        warranty_special_conditions: vehicle.warranty_special_conditions || '',
        warranty_covered_items: vehicle.warranty_covered_items || '',
        status: vehicle.status
      });
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedVehicle(null);
    setDialogTab(0);
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        acquisition_date: formData.acquisition_date?.toISOString().split('T')[0] || null,
        acquisition_value: formData.acquisition_value ? parseFloat(formData.acquisition_value) : null,
        warranty_period_months: formData.warranty_period_months ? parseInt(formData.warranty_period_months) : null
      };

      let response: ApiResponse<Vehicle>;
      
      if (dialogMode === 'create') {
        response = await apiService.post('/vehicles', submitData);
      } else {
        response = await apiService.put(`/vehicles/${selectedVehicle?.id}`, submitData);
      }

      if (response.success) {
        showSnackbar(response.message || 'Operação realizada com sucesso', 'success');
        handleCloseDialog();
        await loadVehicles();
      } else {
        showSnackbar(response.error || 'Erro na operação', 'error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      showSnackbar('Erro ao processar solicitação', 'error');
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!window.confirm(`Tem certeza que deseja excluir o veículo ${vehicle.license_plate}?`)) {
      return;
    }

    try {
      const response = await apiService.delete(`/vehicles/${vehicle.id}`);
      if (response.success) {
        showSnackbar('Veículo excluído com sucesso', 'success');
        await loadVehicles();
      } else {
        showSnackbar(response.error || 'Erro ao excluir veículo', 'error');
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      showSnackbar('Erro ao excluir veículo', 'error');
    }
  };

  const handleReactivate = async (vehicle: Vehicle) => {
    try {
      const response = await apiService.patch(`/vehicles/${vehicle.id}/reactivate`, {});
      if (response.success) {
        showSnackbar('Veículo reativado com sucesso', 'success');
        await loadVehicles();
      } else {
        showSnackbar(response.error || 'Erro ao reativar veículo', 'error');
      }
    } catch (error) {
      console.error('Error reactivating vehicle:', error);
      showSnackbar('Erro ao reativar veículo', 'error');
    }
  };

  const handleStatusChange = async (vehicle: Vehicle, newStatus: string) => {
    try {
      const response = await apiService.patch(`/vehicles/${vehicle.id}/status`, { status: newStatus });
      if (response.success) {
        showSnackbar('Status atualizado com sucesso', 'success');
        await loadVehicles();
      } else {
        showSnackbar(response.error || 'Erro ao atualizar status', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showSnackbar('Erro ao atualizar status', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return 'success';
      case 'em_uso': return 'primary';
      case 'manutencao': return 'warning';
      case 'indisponivel': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'em_uso': return 'Em Uso';
      case 'manutencao': return 'Manutenção';
      case 'indisponivel': return 'Indisponível';
      default: return status;
    }
  };

  const getFuelTypeText = (fuelType: string) => {
    switch (fuelType) {
      case 'gasolina': return 'Gasolina';
      case 'etanol': return 'Etanol';
      case 'diesel': return 'Diesel';
      case 'flex': return 'Flex';
      case 'gnv': return 'GNV';
      case 'eletrico': return 'Elétrico';
      case 'hibrido': return 'Híbrido';
      default: return fuelType;
    }
  };

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.chassis_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: GridColDef[] = [
    { field: 'license_plate', headerName: 'Placa', width: 120 },
    { field: 'brand', headerName: 'Marca', width: 120 },
    { field: 'model', headerName: 'Modelo', width: 140 },
    { field: 'model_year', headerName: 'Ano', width: 80 },
    { field: 'category', headerName: 'Categoria', width: 120 },
    {
      field: 'fuel_type',
      headerName: 'Combustível',
      width: 120,
      renderCell: (params) => getFuelTypeText(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={getStatusText(params.value)}
          color={getStatusColor(params.value) as any}
          size="small"
        />
      ),
    },
    {
      field: 'assignment',
      headerName: 'Atribuição',
      width: 180,
      renderCell: (params) => {
        const vehicle = params.row as Vehicle;
        const assignment = vehicleAssignments.get(vehicle.id);
        
        if (!assignment) {
          return (
            <Chip
              label="Não atribuído"
              color="default"
              size="small"
            />
          );
        }
        
        return (
          <Box>
            <Chip
              label={assignment.assignment_type === 'permanent' ? 'Permanente' : 'Temporário'}
              color={assignment.assignment_type === 'permanent' ? 'primary' : 'secondary'}
              size="small"
            />
            {assignment.driver && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {assignment.driver.full_name}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'is_active',
      headerName: 'Ativo',
      width: 80,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Sim' : 'Não'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 150,
      getActions: (params) => {
        const vehicle = params.row as Vehicle;
        const actions = [
          <GridActionsCellItem
            icon={<Visibility />}
            label="Visualizar"
            onClick={() => handleOpenDialog('view', vehicle)}
          />
        ];

        if (canManageVehicles) {
          actions.push(
            <GridActionsCellItem
              icon={<Edit />}
              label="Editar"
              onClick={() => handleOpenDialog('edit', vehicle)}
            />
          );
        }

        if (canDeleteVehicles) {
          if (vehicle.is_active) {
            actions.push(
              <GridActionsCellItem
                icon={<Delete />}
                label="Excluir"
                onClick={() => handleDelete(vehicle)}
              />
            );
          } else {
            actions.push(
              <GridActionsCellItem
                icon={<CheckCircle />}
                label="Reativar"
                onClick={() => handleReactivate(vehicle)}
              />
            );
          }
        }

        return actions;
      },
    },
  ];

  const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
    const assignment = vehicleAssignments.get(vehicle.id);
    
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                <DirectionsCar />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {vehicle.license_plate}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {vehicle.brand} {vehicle.model}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
              <Chip
                label={vehicle.is_active ? 'Ativo' : 'Inativo'}
                color={vehicle.is_active ? 'success' : 'default'}
                size="small"
              />
              <Chip
                label={getStatusText(vehicle.status)}
                color={getStatusColor(vehicle.status) as any}
                size="small"
              />
              {assignment ? (
                <Chip
                  label={assignment.assignment_type === 'permanent' ? 'Permanente' : 'Temporário'}
                  color={assignment.assignment_type === 'permanent' ? 'primary' : 'secondary'}
                  size="small"
                />
              ) : (
                <Chip
                  label="Não atribuído"
                  color="default"
                  size="small"
                />
              )}
            </Box>
          </Box>
          
          {assignment && (
            <Box mb={2} p={2} sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                Atribuição Atual
              </Typography>
              {assignment.driver && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Condutor:</strong> {assignment.driver.full_name}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                <strong>Tipo:</strong> {assignment.assignment_type === 'permanent' ? 'Permanente' : 'Temporário'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Início:</strong> {new Date(assignment.start_date).toLocaleDateString('pt-BR')}
              </Typography>
              {assignment.end_date && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Fim:</strong> {new Date(assignment.end_date).toLocaleDateString('pt-BR')}
                </Typography>
              )}
            </Box>
          )}
          
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Ano:</strong> {vehicle.model_year}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Categoria:</strong> {vehicle.category}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Combustível:</strong> {getFuelTypeText(vehicle.fuel_type)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Departamento:</strong> {vehicle.responsible_department}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Cidade Base:</strong> {vehicle.base_city}
              </Typography>
            </Grid>
          </Grid>

          {canManageVehicles && vehicle.is_active && (
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                <strong>Alterar Status:</strong>
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {['disponivel', 'em_uso', 'manutencao', 'indisponivel'].map((status) => (
                  <Button
                    key={status}
                    size="small"
                    variant={vehicle.status === status ? 'contained' : 'outlined'}
                    color={getStatusColor(status) as any}
                    onClick={() => handleStatusChange(vehicle, status)}
                    disabled={vehicle.status === status}
                  >
                    {getStatusText(status)}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
        <CardActions>
          <Button
            size="small"
            startIcon={<Visibility />}
            onClick={() => handleOpenDialog('view', vehicle)}
          >
            Visualizar
          </Button>
          {canManageVehicles && (
            <Button
              size="small"
              startIcon={<Edit />}
              onClick={() => handleOpenDialog('edit', vehicle)}
            >
              Editar
            </Button>
          )}
          {canDeleteVehicles && (
            vehicle.is_active ? (
              <Button
                size="small"
                color="error"
                startIcon={<Delete />}
                onClick={() => handleDelete(vehicle)}
              >
                Excluir
              </Button>
            ) : (
              <Button
                size="small"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => handleReactivate(vehicle)}
              >
                Reativar
              </Button>
            )
          )}
        </CardActions>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Veículos
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadVehicles}
          >
            Atualizar
          </Button>
          {canManageVehicles && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog('create')}
            >
              Novo Veículo
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <TextField
            placeholder="Buscar por placa, marca, modelo ou chassi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: 350 }}
          />
          <Box display="flex" gap={1}>
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
            >
              Tabela
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
            >
              Cards
            </Button>
          </Box>
        </Box>
      </Paper>

      {viewMode === 'table' ? (
        <Paper>
          <DataGrid
            rows={filteredVehicles}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 },
              },
            }}
            pageSizeOptions={[5, 10, 25]}
            disableRowSelectionOnClick
            autoHeight
          />
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredVehicles.map((vehicle) => (
            <Grid item xs={12} md={6} lg={4} key={vehicle.id}>
              <VehicleCard vehicle={vehicle} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Vehicle Form Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' && 'Novo Veículo'}
          {dialogMode === 'edit' && 'Editar Veículo'}
          {dialogMode === 'view' && 'Detalhes do Veículo'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={dialogTab}
            onChange={(_, newValue) => setDialogTab(newValue)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label="Informações do Veículo"
              icon={<DirectionsCar />}
              iconPosition="start"
            />
            {(dialogMode === 'edit' || dialogMode === 'view') && selectedVehicle && (
              <Tab
                label="Documentos"
                icon={<Description />}
                iconPosition="start"
              />
            )}
          </Tabs>

          {/* Tab Content */}
          <Box sx={{ p: 3 }}>
            {dialogTab === 0 && (
              <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Placa"
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Número do Chassi"
                value={formData.chassis_number}
                onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="RENAVAM"
                value={formData.renavam}
                onChange={(e) => setFormData({ ...formData, renavam: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Código Interno"
                value={formData.internal_code}
                onChange={(e) => setFormData({ ...formData, internal_code: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Marca"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Modelo"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Ano de Fabricação"
                type="number"
                value={formData.manufacture_year}
                onChange={(e) => setFormData({ ...formData, manufacture_year: parseInt(e.target.value) })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Ano do Modelo"
                type="number"
                value={formData.model_year}
                onChange={(e) => setFormData({ ...formData, model_year: parseInt(e.target.value) })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Categoria"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Combustível</InputLabel>
                <Select
                  value={formData.fuel_type}
                  onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value as any })}
                  disabled={dialogMode === 'view'}
                  required
                >
                  <MenuItem value="gasolina">Gasolina</MenuItem>
                  <MenuItem value="etanol">Etanol</MenuItem>
                  <MenuItem value="diesel">Diesel</MenuItem>
                  <MenuItem value="flex">Flex</MenuItem>
                  <MenuItem value="gnv">GNV</MenuItem>
                  <MenuItem value="eletrico">Elétrico</MenuItem>
                  <MenuItem value="hibrido">Híbrido</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Departamento Responsável"
                value={formData.responsible_department}
                onChange={(e) => setFormData({ ...formData, responsible_department: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Centro de Custo"
                value={formData.cost_center}
                onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cidade Base"
                value={formData.base_city}
                onChange={(e) => setFormData({ ...formData, base_city: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Valor de Aquisição"
                type="number"
                value={formData.acquisition_value}
                onChange={(e) => setFormData({ ...formData, acquisition_value: e.target.value })}
                disabled={dialogMode === 'view'}
                InputProps={{
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                <DatePicker
                  label="Data de Aquisição"
                  value={formData.acquisition_date}
                  onChange={(date) => setFormData({ ...formData, acquisition_date: date })}
                  disabled={dialogMode === 'view'}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Fornecedor da Garantia"
                value={formData.warranty_supplier}
                onChange={(e) => setFormData({ ...formData, warranty_supplier: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Período de Garantia (meses)"
                type="number"
                value={formData.warranty_period_months}
                onChange={(e) => setFormData({ ...formData, warranty_period_months: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Condições Especiais da Garantia"
                multiline
                rows={2}
                value={formData.warranty_special_conditions}
                onChange={(e) => setFormData({ ...formData, warranty_special_conditions: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Itens Cobertos pela Garantia"
                multiline
                rows={2}
                value={formData.warranty_covered_items}
                onChange={(e) => setFormData({ ...formData, warranty_covered_items: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            {dialogMode !== 'view' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <MenuItem value="disponivel">Disponível</MenuItem>
                    <MenuItem value="em_uso">Em Uso</MenuItem>
                    <MenuItem value="manutencao">Manutenção</MenuItem>
                    <MenuItem value="indisponivel">Indisponível</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
              </Grid>
            )}

            {dialogTab === 1 && selectedVehicle && (
              <DocumentManager
                entityType="vehicle"
                entityId={selectedVehicle.id}
                allowUpload={dialogMode !== 'view' && (user?.role === 'admin' || user?.role === 'gestor_frota')}
                allowDelete={user?.role === 'admin' || user?.role === 'gestor_frota'}
                allowDownload={true}
                onDocumentChange={() => {
                  // Vehicle data doesn't need to be refreshed for document changes
                  console.log('Documents updated for vehicle:', selectedVehicle.id);
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            {dialogMode === 'view' ? 'Fechar' : 'Cancelar'}
          </Button>
          {dialogMode !== 'view' && dialogTab === 0 && (
            <Button onClick={handleSubmit} variant="contained">
              {dialogMode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VehiclesPage;