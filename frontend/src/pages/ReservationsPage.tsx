import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  TablePagination,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  DirectionsCar as CarIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Reservation, Driver, Vehicle, ApiResponse } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reservations-tabpanel-${index}`}
      aria-labelledby={`reservations-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ReservationsPage: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'approve' | 'checkout' | 'checkin' | 'cancel'>('create');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form states
  const [formData, setFormData] = useState({
    driver_id: '',
    vehicle_id: '',
    start_date: new Date(),
    end_date: new Date(),
    purpose: '',
    destination: '',
    notes: '',
    approval_notes: '',
    checkout_km: '',
    fuel_level_checkout: '',
    checkout_condition: '',
    checkout_photos: [] as string[],
    checkin_km: '',
    fuel_level_checkin: '',
    checkin_condition: '',
    checkin_photos: [] as string[]
  });

  const canManageReservations = user?.role === 'admin' || user?.role === 'gestor_frota';
  const canCreateReservations = user?.role === 'admin' || user?.role === 'gestor_frota' || user?.role === 'condutor';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reservationsRes, driversRes, vehiclesRes] = await Promise.all([
        apiService.get('/reservations'),
        apiService.get('/drivers'),
        apiService.get('/vehicles')
      ]);

      if (reservationsRes.success) {
        setReservations(reservationsRes.data as Reservation[]);
      }
      if (driversRes.success) {
        setDrivers(driversRes.data as Driver[]);
      }
      if (vehiclesRes.success) {
        setVehicles(vehiclesRes.data as Vehicle[]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showSnackbar('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'pendente': return 'warning';
      case 'aprovada': return 'info';
      case 'rejeitada': return 'error';
      case 'em_andamento': return 'primary';
      case 'finalizada': return 'success';
      case 'cancelada': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'aprovada': return 'Aprovada';
      case 'rejeitada': return 'Rejeitada';
      case 'em_andamento': return 'Em Andamento';
      case 'finalizada': return 'Finalizada';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const filterReservations = (status?: string) => {
    if (!status) return reservations;
    return reservations.filter(r => r.status === status);
  };

  const handleOpenDialog = (mode: typeof dialogMode, reservation?: Reservation) => {
    setDialogMode(mode);
    setSelectedReservation(reservation || null);
    
    if (mode === 'create') {
      setFormData({
        driver_id: '',
        vehicle_id: '',
        start_date: new Date(),
        end_date: new Date(),
        purpose: '',
        destination: '',
        notes: '',
        approval_notes: '',
        checkout_km: '',
        fuel_level_checkout: '',
        checkout_condition: '',
        checkout_photos: [],
        checkin_km: '',
        fuel_level_checkin: '',
        checkin_condition: '',
        checkin_photos: []
      });
    } else if (reservation) {
      setFormData({
        driver_id: reservation.driver_id,
        vehicle_id: reservation.vehicle_id,
        start_date: new Date(reservation.start_date),
        end_date: new Date(reservation.end_date),
        purpose: reservation.purpose || '',
        destination: reservation.destination || '',
        notes: reservation.notes || '',
        approval_notes: reservation.approval_notes || '',
        checkout_km: reservation.checkout_km?.toString() || '',
        fuel_level_checkout: reservation.fuel_level_checkout?.toString() || '',
        checkout_condition: reservation.checkout_condition || '',
        checkout_photos: reservation.checkout_photos || [],
        checkin_km: reservation.checkin_km?.toString() || '',
        fuel_level_checkin: reservation.fuel_level_checkin?.toString() || '',
        checkin_condition: reservation.checkin_condition || '',
        checkin_photos: reservation.checkin_photos || []
      });
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedReservation(null);
  };

  const handleSubmit = async () => {
    try {
      let response: ApiResponse<any>;

      switch (dialogMode) {
        case 'create':
          response = await apiService.post('/reservations', {
            driver_id: formData.driver_id,
            vehicle_id: formData.vehicle_id,
            start_date: formData.start_date.toISOString(),
            end_date: formData.end_date.toISOString(),
            purpose: formData.purpose,
            destination: formData.destination,
            notes: formData.notes
          });
          break;

        case 'approve':
          response = await apiService.patch(`/reservations/${selectedReservation?.id}/approve`, {
            action: 'approve',
            notes: formData.approval_notes
          });
          break;

        case 'checkout':
          response = await apiService.patch(`/reservations/${selectedReservation?.id}/checkout`, {
            checkout_km: parseInt(formData.checkout_km),
            fuel_level_checkout: parseInt(formData.fuel_level_checkout),
            checkout_condition: formData.checkout_condition,
            checkout_photos: formData.checkout_photos
          });
          break;

        case 'checkin':
          response = await apiService.patch(`/reservations/${selectedReservation?.id}/checkin`, {
            checkin_km: parseInt(formData.checkin_km),
            fuel_level_checkin: parseInt(formData.fuel_level_checkin),
            checkin_condition: formData.checkin_condition,
            checkin_photos: formData.checkin_photos
          });
          break;

        case 'cancel':
          response = await apiService.patch(`/reservations/${selectedReservation?.id}/cancel`, {});
          break;

        default:
          return;
      }

      if (response.success) {
        showSnackbar(response.message || 'Operação realizada com sucesso', 'success');
        handleCloseDialog();
        await loadData();
      } else {
        showSnackbar(response.error || 'Erro na operação', 'error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      showSnackbar('Erro ao processar solicitação', 'error');
    }
  };

  const handleReject = async () => {
    try {
      const response = await apiService.patch(`/reservations/${selectedReservation?.id}/approve`, {
        action: 'reject',
        notes: formData.approval_notes
      });

      if (response.success) {
        showSnackbar('Reserva rejeitada com sucesso', 'success');
        handleCloseDialog();
        await loadData();
      } else {
        showSnackbar(response.error || 'Erro ao rejeitar reserva', 'error');
      }
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      showSnackbar('Erro ao rejeitar reserva', 'error');
    }
  };

  const getDialogTitle = () => {
    switch (dialogMode) {
      case 'create': return 'Nova Reserva';
      case 'approve': return 'Aprovar/Rejeitar Reserva';
      case 'checkout': return 'Check-out do Veículo';
      case 'checkin': return 'Check-in do Veículo';
      case 'cancel': return 'Cancelar Reserva';
      default: return '';
    }
  };

  const renderDialogContent = () => {
    switch (dialogMode) {
      case 'create':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Condutor</InputLabel>
                <Select
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                >
                  {drivers.map((driver) => (
                    <MenuItem key={driver.id} value={driver.id}>
                      {driver.full_name} - {driver.cpf}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Veículo</InputLabel>
                <Select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                >
                  {vehicles.filter(v => v.status === 'disponivel').map((vehicle) => (
                    <MenuItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                <DateTimePicker
                  label="Data/Hora Início"
                  value={formData.start_date}
                  onChange={(date) => setFormData({ ...formData, start_date: date || new Date() })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                <DateTimePicker
                  label="Data/Hora Fim"
                  value={formData.end_date}
                  onChange={(date) => setFormData({ ...formData, end_date: date || new Date() })}
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
                label="Finalidade"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Destino"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Observações"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        );

      case 'approve':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Detalhes da Reserva
              </Typography>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography><strong>Condutor:</strong> {selectedReservation?.drivers?.full_name}</Typography>
                  <Typography><strong>Veículo:</strong> {selectedReservation?.vehicles?.license_plate} - {selectedReservation?.vehicles?.brand} {selectedReservation?.vehicles?.model}</Typography>
                  <Typography><strong>Período:</strong> {format(new Date(selectedReservation?.start_date || ''), 'dd/MM/yyyy HH:mm')} - {format(new Date(selectedReservation?.end_date || ''), 'dd/MM/yyyy HH:mm')}</Typography>
                  <Typography><strong>Finalidade:</strong> {selectedReservation?.purpose}</Typography>
                  <Typography><strong>Destino:</strong> {selectedReservation?.destination}</Typography>
                  {selectedReservation?.notes && (
                    <Typography><strong>Observações:</strong> {selectedReservation.notes}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Observações da Aprovação"
                value={formData.approval_notes}
                onChange={(e) => setFormData({ ...formData, approval_notes: e.target.value })}
              />
            </Grid>
          </Grid>
        );

      case 'checkout':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Quilometragem Inicial"
                type="number"
                value={formData.checkout_km}
                onChange={(e) => setFormData({ ...formData, checkout_km: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nível de Combustível (%)"
                type="number"
                value={formData.fuel_level_checkout}
                onChange={(e) => setFormData({ ...formData, fuel_level_checkout: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Condições do Veículo"
                value={formData.checkout_condition}
                onChange={(e) => setFormData({ ...formData, checkout_condition: e.target.value })}
              />
            </Grid>
          </Grid>
        );

      case 'checkin':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Quilometragem Final"
                type="number"
                value={formData.checkin_km}
                onChange={(e) => setFormData({ ...formData, checkin_km: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nível de Combustível (%)"
                type="number"
                value={formData.fuel_level_checkin}
                onChange={(e) => setFormData({ ...formData, fuel_level_checkin: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Condições do Veículo"
                value={formData.checkin_condition}
                onChange={(e) => setFormData({ ...formData, checkin_condition: e.target.value })}
              />
            </Grid>
          </Grid>
        );

      case 'cancel':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="warning">
                Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.
              </Alert>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  const renderReservationCard = (reservation: Reservation) => (
    <Card key={reservation.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Stack spacing={1}>
            <Typography variant="h6" component="h3">
              {reservation.vehicles?.license_plate} - {reservation.vehicles?.brand} {reservation.vehicles?.model}
            </Typography>
            <Chip
              label={getStatusLabel(reservation.status)}
              color={getStatusColor(reservation.status)}
              size="small"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            {reservation.status === 'pendente' && canManageReservations && (
              <Tooltip title="Aprovar/Rejeitar">
                <IconButton
                  color="primary"
                  onClick={() => handleOpenDialog('approve', reservation)}
                >
                  <CheckCircleIcon />
                </IconButton>
              </Tooltip>
            )}
            {reservation.status === 'aprovada' && canManageReservations && (
              <Tooltip title="Check-out">
                <IconButton
                  color="info"
                  onClick={() => handleOpenDialog('checkout', reservation)}
                >
                  <CarIcon />
                </IconButton>
              </Tooltip>
            )}
            {reservation.status === 'em_andamento' && canManageReservations && (
              <Tooltip title="Check-in">
                <IconButton
                  color="success"
                  onClick={() => handleOpenDialog('checkin', reservation)}
                >
                  <AssessmentIcon />
                </IconButton>
              </Tooltip>
            )}
            {['pendente', 'aprovada'].includes(reservation.status) && (
              <Tooltip title="Cancelar">
                <IconButton
                  color="error"
                  onClick={() => handleOpenDialog('cancel', reservation)}
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" mb={1}>
              <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                {reservation.drivers?.full_name}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" mb={1}>
              <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                {format(new Date(reservation.start_date), 'dd/MM/yyyy')} - {format(new Date(reservation.end_date), 'dd/MM/yyyy')}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" mb={1}>
              <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">
                {format(new Date(reservation.start_date), 'HH:mm')} - {format(new Date(reservation.end_date), 'HH:mm')}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            {reservation.purpose && (
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Finalidade:</strong> {reservation.purpose}
                </Typography>
              </Box>
            )}
            {reservation.destination && (
              <Box display="flex" alignItems="center" mb={1}>
                <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {reservation.destination}
                </Typography>
              </Box>
            )}
            {reservation.notes && (
              <Typography variant="body2" color="text.secondary">
                <strong>Obs:</strong> {reservation.notes}
              </Typography>
            )}
          </Grid>
        </Grid>

        {reservation.approval_notes && (
          <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
            <Typography variant="body2" color="text.secondary">
              <strong>Observações da Aprovação:</strong> {reservation.approval_notes}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

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
          Reservas
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={refreshData}
            disabled={refreshing}
          >
            Atualizar
          </Button>
          {canCreateReservations && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('create')}
            >
              Nova Reserva
            </Button>
          )}
        </Stack>
      </Box>

      <Paper>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label={`Todas (${reservations.length})`} />
          <Tab label={`Pendentes (${filterReservations('pendente').length})`} />
          <Tab label={`Aprovadas (${filterReservations('aprovada').length})`} />
          <Tab label={`Em Andamento (${filterReservations('em_andamento').length})`} />
          <Tab label={`Finalizadas (${filterReservations('finalizada').length})`} />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          {reservations.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                Nenhuma reserva encontrada
              </Typography>
            </Box>
          ) : (
            reservations.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(renderReservationCard)
          )}
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {filterReservations('pendente').slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(renderReservationCard)}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          {filterReservations('aprovada').slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(renderReservationCard)}
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          {filterReservations('em_andamento').slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(renderReservationCard)}
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          {filterReservations('finalizada').slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(renderReservationCard)}
        </TabPanel>

        <TablePagination
          component="div"
          count={currentTab === 0 ? reservations.length : filterReservations(['pendente', 'aprovada', 'em_andamento', 'finalizada'][currentTab - 1]).length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Itens por página:"
        />
      </Paper>

      {/* Dialog for various actions */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{getDialogTitle()}</DialogTitle>
        <DialogContent>
          {renderDialogContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancelar
          </Button>
          {dialogMode === 'approve' && (
            <Button onClick={handleReject} color="error">
              Rejeitar
            </Button>
          )}
          <Button onClick={handleSubmit} variant="contained">
            {dialogMode === 'approve' ? 'Aprovar' : 'Confirmar'}
          </Button>
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

export default ReservationsPage;