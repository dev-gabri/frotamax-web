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
  Autocomplete,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Search,
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
import { format, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Driver, ApiResponse, VehicleAssignment, Employee } from '../types';
import { DocumentManager } from '../components/DocumentManager';
import { AssignmentService } from '../services/assignmentService';
import { employeeService } from '../services/employeeService';

const DriversPage: React.FC = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<Map<string, VehicleAssignment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  const [dialogTab, setDialogTab] = useState(0);
  const [isEmployee, setIsEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);
  const [cpfValidation, setCpfValidation] = useState<{
    isEmployee: boolean;
    employeeName?: string;
    message?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    employee_id: '',
    cpf: '',
    full_name: '',
    email: '',
    phone: '',
    cnh_number: '',
    cnh_category: 'B',
    cnh_expiry_date: new Date(),
    internal_terms_status: 'pending',
    internal_terms_signed_date: null as Date | null,
    internal_terms_expiry_date: null as Date | null
  });

  const canManageDrivers = user?.role === 'admin' || user?.role === 'rh';
  const canDeleteDrivers = user?.role === 'admin';

  useEffect(() => {
    loadDrivers();
    loadDriverAssignments();
  }, []);

  const loadDriverAssignments = async () => {
    try {
      const assignments = await AssignmentService.getAssignments({ status: 'active' });
      const assignmentMap = new Map<string, VehicleAssignment>();
      
      if (assignments && (assignments as any).data) {
        ((assignments as any).data as VehicleAssignment[]).forEach((assignment: VehicleAssignment) => {
          if (assignment.status === 'active') {
            assignmentMap.set(assignment.driver_id, assignment);
          }
        });
      }
      
      setDriverAssignments(assignmentMap);
    } catch (error) {
      console.error('Error loading driver assignments:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<Driver[]>('/drivers');
      if (response.success) {
        setDrivers(response.data as Driver[]);
      } else {
        showSnackbar('Erro ao carregar condutores', 'error');
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
      showSnackbar('Erro ao carregar condutores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (mode: 'create' | 'edit' | 'view', driver?: Driver) => {
    setDialogMode(mode);
    setSelectedDriver(driver || null);
    setIsEmployee(false);
    setSelectedEmployee(null);
    setCpfValidation(null);
    setEmployeeOptions([]);
    
    if (mode === 'create') {
      setFormData({
        employee_id: '',
        cpf: '',
        full_name: '',
        email: '',
        phone: '',
        cnh_number: '',
        cnh_category: 'B',
        cnh_expiry_date: new Date(),
        internal_terms_status: 'pending',
        internal_terms_signed_date: null,
        internal_terms_expiry_date: null
      });
    } else if (driver) {
      setFormData({
        employee_id: driver.employee_id || '',
        cpf: driver.cpf,
        full_name: driver.full_name,
        email: driver.email || '',
        phone: driver.phone || '',
        cnh_number: driver.cnh_number,
        cnh_category: driver.cnh_category,
        cnh_expiry_date: new Date(driver.cnh_expiry_date),
        internal_terms_status: driver.internal_terms_status,
        internal_terms_signed_date: driver.internal_terms_signed_date ? new Date(driver.internal_terms_signed_date) : null,
        internal_terms_expiry_date: driver.internal_terms_expiry_date ? new Date(driver.internal_terms_expiry_date) : null
      });
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDriver(null);
    setDialogTab(0);
    setIsEmployee(false);
    setSelectedEmployee(null);
    setCpfValidation(null);
    setEmployeeOptions([]);
  };

  const searchEmployees = async (query: string) => {
    if (query.length < 2) {
      setEmployeeOptions([]);
      return;
    }

    setEmployeeSearchLoading(true);
    try {
      const response = await employeeService.searchEmployeesForDriver(query);
      if (response.success) {
        setEmployeeOptions(response.data as Employee[]);
      }
    } catch (error) {
      console.error('Error searching employees:', error);
    } finally {
      setEmployeeSearchLoading(false);
    }
  };

  const validateCpf = async (cpf: string) => {
    if (!cpf || cpf.length < 11 || isEmployee) {
      setCpfValidation(null);
      return;
    }

    try {
      const response = await employeeService.searchEmployeesForDriver(cpf);
      if (response.success && response.data && response.data.length > 0) {
        const employee = response.data[0] as Employee;
        setCpfValidation({
          isEmployee: true,
          employeeName: employee.full_name,
          message: `CPF corresponde ao colaborador ${employee.full_name}. Os dados serão preenchidos automaticamente.`
        });
        
        // Auto-fill employee data
        setFormData(prev => ({
          ...prev,
          employee_id: employee.id,
          full_name: employee.full_name
        }));
      } else {
        setCpfValidation(null);
      }
    } catch (error) {
      console.error('Error validating CPF:', error);
      setCpfValidation(null);
    }
  };

  const handleEmployeeSelection = (employee: Employee | null) => {
    setSelectedEmployee(employee);
    if (employee) {
      setFormData(prev => ({
        ...prev,
        employee_id: employee.id,
        cpf: employee.cpf,
        full_name: employee.full_name
      }));
      setCpfValidation(null);
    } else {
      setFormData(prev => ({
        ...prev,
        employee_id: '',
        cpf: '',
        full_name: ''
      }));
    }
  };

  const handleIsEmployeeChange = (checked: boolean) => {
    setIsEmployee(checked);
    if (!checked) {
      setSelectedEmployee(null);
      setFormData(prev => ({
        ...prev,
        employee_id: '',
        cpf: '',
        full_name: ''
      }));
      setCpfValidation(null);
    }
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        cnh_expiry_date: formData.cnh_expiry_date.toISOString().split('T')[0],
        internal_terms_signed_date: formData.internal_terms_signed_date?.toISOString().split('T')[0] || null,
        internal_terms_expiry_date: formData.internal_terms_expiry_date?.toISOString().split('T')[0] || null
      };

      let response: ApiResponse<Driver>;
      
      if (dialogMode === 'create') {
        response = await apiService.post('/drivers', submitData);
      } else {
        response = await apiService.put(`/drivers/${selectedDriver?.id}`, submitData);
      }

      if (response.success) {
        showSnackbar(response.message || 'Operação realizada com sucesso', 'success');
        handleCloseDialog();
        await loadDrivers();
      } else {
        showSnackbar(response.error || 'Erro na operação', 'error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      showSnackbar('Erro ao processar solicitação', 'error');
    }
  };

  const handleDelete = async (driver: Driver) => {
    if (!window.confirm(`Tem certeza que deseja excluir o condutor ${driver.full_name}?`)) {
      return;
    }

    try {
      const response = await apiService.delete(`/drivers/${driver.id}`);
      if (response.success) {
        showSnackbar('Condutor excluído com sucesso', 'success');
        await loadDrivers();
      } else {
        showSnackbar(response.error || 'Erro ao excluir condutor', 'error');
      }
    } catch (error) {
      console.error('Error deleting driver:', error);
      showSnackbar('Erro ao excluir condutor', 'error');
    }
  };

  const handleReactivate = async (driver: Driver) => {
    try {
      const response = await apiService.patch(`/drivers/${driver.id}/reactivate`, {});
      if (response.success) {
        showSnackbar('Condutor reativado com sucesso', 'success');
        await loadDrivers();
      } else {
        showSnackbar(response.error || 'Erro ao reativar condutor', 'error');
      }
    } catch (error) {
      console.error('Error reactivating driver:', error);
      showSnackbar('Erro ao reativar condutor', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'success';
      case 'pending': return 'warning';
      case 'expired': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'signed': return 'Assinado';
      case 'pending': return 'Pendente';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = addDays(today, 30);
    const sevenDaysFromNow = addDays(today, 7);

    if (isBefore(expiry, today)) {
      return { status: 'expired', color: 'error', text: 'Vencido' };
    } else if (isBefore(expiry, sevenDaysFromNow)) {
      return { status: 'critical', color: 'error', text: 'Vence em breve' };
    } else if (isBefore(expiry, thirtyDaysFromNow)) {
      return { status: 'warning', color: 'warning', text: 'Atenção' };
    } else {
      return { status: 'valid', color: 'success', text: 'Válido' };
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.cpf.includes(searchTerm) ||
    driver.cnh_number.includes(searchTerm)
  );

  const columns: GridColDef[] = [
    { field: 'full_name', headerName: 'Nome', width: 180 },
    { field: 'cpf', headerName: 'CPF', width: 130 },
    { field: 'cnh_number', headerName: 'CNH', width: 130 },
    { field: 'cnh_category', headerName: 'Categoria', width: 100 },
    {
      field: 'cnh_expiry_date',
      headerName: 'Validade CNH',
      width: 150,
      renderCell: (params) => {
        const status = getExpiryStatus(params.value);
        return (
          <Box display="flex" alignItems="center">
            <Typography variant="body2" sx={{ mr: 1 }}>
              {format(new Date(params.value), 'dd/MM/yyyy')}
            </Typography>
            <Chip
              label={status.text}
              color={status.color as any}
              size="small"
            />
          </Box>
        );
      },
    },
    {
      field: 'internal_terms_status',
      headerName: 'Termo Interno',
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
      headerName: 'Veículo Atribuído',
      width: 180,
      renderCell: (params) => {
        const driver = params.row as Driver;
        const assignment = driverAssignments.get(driver.id);
        
        if (!assignment) {
          return (
            <Chip
              label="Sem atribuição"
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
            {assignment.vehicle && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {assignment.vehicle.license_plate}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Ativo' : 'Inativo'}
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
        const driver = params.row as Driver;
        const actions = [
          <GridActionsCellItem
            icon={<Visibility />}
            label="Visualizar"
            onClick={() => handleOpenDialog('view', driver)}
          />
        ];

        if (canManageDrivers) {
          actions.push(
            <GridActionsCellItem
              icon={<Edit />}
              label="Editar"
              onClick={() => handleOpenDialog('edit', driver)}
            />
          );
        }

        if (canDeleteDrivers) {
          if (driver.is_active) {
            actions.push(
              <GridActionsCellItem
                icon={<Delete />}
                label="Excluir"
                onClick={() => handleDelete(driver)}
              />
            );
          } else {
            actions.push(
              <GridActionsCellItem
                icon={<CheckCircle />}
                label="Reativar"
                onClick={() => handleReactivate(driver)}
              />
            );
          }
        }

        return actions;
      },
    },
  ];

  const DriverCard = ({ driver }: { driver: Driver }) => {
    const cnhStatus = getExpiryStatus(driver.cnh_expiry_date);
    const assignment = driverAssignments.get(driver.id);

    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                {driver.full_name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {driver.full_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  CNH: {driver.cnh_number}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={driver.is_active ? 'Ativo' : 'Inativo'}
              color={driver.is_active ? 'success' : 'default'}
              size="small"
            />
          </Box>
          
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>CPF:</strong> {driver.cpf}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Categoria:</strong> {driver.cnh_category}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                <strong>Email:</strong> {driver.email}
              </Typography>
            </Grid>
          </Grid>

          <Box display="flex" alignItems="center" mb={1}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              <strong>CNH válida até:</strong> {format(new Date(driver.cnh_expiry_date), 'dd/MM/yyyy')}
            </Typography>
            <Chip
              label={cnhStatus.text}
              color={cnhStatus.color as any}
              size="small"
            />
          </Box>

          <Box display="flex" alignItems="center" mb={2}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              <strong>Termo interno:</strong>
            </Typography>
            <Chip
              label={getStatusText(driver.internal_terms_status)}
              color={getStatusColor(driver.internal_terms_status) as any}
              size="small"
            />
          </Box>

          {assignment && (
            <Box mb={2} p={2} sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                Veículo Atribuído
              </Typography>
              {assignment.vehicle && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Veículo:</strong> {assignment.vehicle.license_plate} - {assignment.vehicle.brand} {assignment.vehicle.model}
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

          {!assignment && (
            <Box mb={2} p={2} sx={{ bgcolor: 'grey.50', borderRadius: 1, border: 1, borderColor: 'grey.200' }}>
              <Typography variant="body2" color="text.secondary" align="center">
                Nenhum veículo atribuído
              </Typography>
            </Box>
          )}
        </CardContent>
        <CardActions>
          <Button
            size="small"
            startIcon={<Visibility />}
            onClick={() => handleOpenDialog('view', driver)}
          >
            Visualizar
          </Button>
          {canManageDrivers && (
            <Button
              size="small"
              startIcon={<Edit />}
              onClick={() => handleOpenDialog('edit', driver)}
            >
              Editar
            </Button>
          )}
          {canDeleteDrivers && (
            driver.is_active ? (
              <Button
                size="small"
                color="error"
                startIcon={<Delete />}
                onClick={() => handleDelete(driver)}
              >
                Excluir
              </Button>
            ) : (
              <Button
                size="small"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => handleReactivate(driver)}
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
          Condutores
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDrivers}
          >
            Atualizar
          </Button>
          {canManageDrivers && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog('create')}
            >
              Novo Condutor
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <TextField
            placeholder="Buscar por nome, CPF ou CNH..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
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
            rows={filteredDrivers}
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
          {filteredDrivers.map((driver) => (
            <Grid item xs={12} md={6} lg={4} key={driver.id}>
              <DriverCard driver={driver} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Driver Form Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' && 'Novo Condutor'}
          {dialogMode === 'edit' && 'Editar Condutor'}
          {dialogMode === 'view' && 'Detalhes do Condutor'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={dialogTab}
            onChange={(_, newValue) => setDialogTab(newValue)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label="Informações Básicas"
              icon={<Edit />}
              iconPosition="start"
            />
            {(dialogMode === 'edit' || dialogMode === 'view') && selectedDriver && (
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
                {dialogMode === 'create' && (
                  <>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEmployee}
                            onChange={(e) => handleIsEmployeeChange(e.target.checked)}
                          />
                        }
                        label="É Colaborador da Empresa?"
                      />
                    </Grid>
                    
                    {isEmployee && (
                      <Grid item xs={12}>
                        <Autocomplete
                          options={employeeOptions}
                          getOptionLabel={(option) => `${option.full_name} - ${option.cpf} - ${option.employee_id}`}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          value={selectedEmployee}
                          onChange={(_, newValue) => handleEmployeeSelection(newValue)}
                          onInputChange={(_, value) => searchEmployees(value)}
                          loading={employeeSearchLoading}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Buscar Colaborador"
                              placeholder="Digite nome, matrícula ou CPF..."
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {employeeSearchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                          noOptionsText="Nenhum colaborador encontrado"
                          loadingText="Buscando..."
                        />
                      </Grid>
                    )}
                  </>
                )}
                
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome Completo"
                value={formData.full_name}
                onChange={(e) => {
                  if (!isEmployee && !cpfValidation?.isEmployee) {
                    setFormData({ ...formData, full_name: e.target.value });
                  }
                }}
                disabled={dialogMode === 'view' || isEmployee || cpfValidation?.isEmployee}
                required
                helperText={
                  (isEmployee || cpfValidation?.isEmployee) 
                    ? "Nome obtido automaticamente dos dados do colaborador" 
                    : ""
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="CPF"
                value={formData.cpf}
                onChange={(e) => {
                  if (!isEmployee) {
                    const newCpf = e.target.value;
                    setFormData({ ...formData, cpf: newCpf });
                    // Debounce CPF validation
                    setTimeout(() => validateCpf(newCpf), 500);
                  }
                }}
                disabled={dialogMode === 'view' || isEmployee}
                required
                helperText={
                  isEmployee 
                    ? "CPF obtido automaticamente dos dados do colaborador" 
                    : ""
                }
              />
              {cpfValidation && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {cpfValidation.message}
                </Alert>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Telefone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={dialogMode === 'view'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Número da CNH"
                value={formData.cnh_number}
                onChange={(e) => setFormData({ ...formData, cnh_number: e.target.value })}
                disabled={dialogMode === 'view'}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Categoria da CNH</InputLabel>
                <Select
                  value={formData.cnh_category}
                  onChange={(e) => setFormData({ ...formData, cnh_category: e.target.value as any })}
                  disabled={dialogMode === 'view'}
                  required
                >
                  <MenuItem value="A">A</MenuItem>
                  <MenuItem value="B">B</MenuItem>
                  <MenuItem value="C">C</MenuItem>
                  <MenuItem value="D">D</MenuItem>
                  <MenuItem value="E">E</MenuItem>
                  <MenuItem value="AB">AB</MenuItem>
                  <MenuItem value="AC">AC</MenuItem>
                  <MenuItem value="AD">AD</MenuItem>
                  <MenuItem value="AE">AE</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                <DatePicker
                  label="Data de Vencimento da CNH"
                  value={formData.cnh_expiry_date}
                  onChange={(date) => setFormData({ ...formData, cnh_expiry_date: date || new Date() })}
                  disabled={dialogMode === 'view'}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status do Termo Interno</InputLabel>
                <Select
                  value={formData.internal_terms_status}
                  onChange={(e) => setFormData({ ...formData, internal_terms_status: e.target.value as any })}
                  disabled={dialogMode === 'view'}
                >
                  <MenuItem value="pending">Pendente</MenuItem>
                  <MenuItem value="signed">Assinado</MenuItem>
                  <MenuItem value="expired">Expirado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
              </Grid>
            )}

            {dialogTab === 1 && selectedDriver && (
              <DocumentManager
                entityType="driver"
                entityId={selectedDriver.id}
                allowUpload={dialogMode !== 'view' && (user?.role === 'admin' || user?.role === 'gestor_frota' || user?.role === 'rh')}
                allowDelete={user?.role === 'admin' || user?.role === 'gestor_frota' || user?.role === 'rh'}
                allowDownload={true}
                onDocumentChange={() => {
                  // Driver data doesn't need to be refreshed for document changes
                  console.log('Documents updated for driver:', selectedDriver.id);
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

export default DriversPage;