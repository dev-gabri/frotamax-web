import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Grid,
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
  Chip,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Search,
  Visibility,
  Refresh,
  FilterList,
  Person,
  Business,
  AccountBalance,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowsProp } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Employee } from '../types';
import { employeeService, EmployeeFilters } from '../services/employeeService';

const EmployeesPage: React.FC = () => {
  const { } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Filtros
  const [filters, setFilters] = useState<EmployeeFilters>({
    page: 1,
    limit: 20,
    order_by: 'full_name',
    order: 'ASC'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
  
  // Paginação
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const currentFilters: EmployeeFilters = {
        ...filters,
        name_query: searchQuery || undefined,
        cpf: cpfFilter || undefined,
        status: statusFilter || undefined,
      };
      
      const response = await employeeService.getEmployees(currentFilters);
      
      if (response.success) {
        // Mapear os dados para incluir 'id' baseado em 'employee_id'
        const mappedEmployees = response.data.map(employee => ({
          ...employee,
          id: employee.employee_id || employee.id || `emp_${Math.random()}`
        }));
        setEmployees(mappedEmployees);
        setPagination(response.pagination);
      } else {
        setError('Erro ao carregar colaboradores');
      }
    } catch (err) {
      console.error('Error loading employees:', err);
      setError('Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, cpfFilter, statusFilter]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    loadEmployees();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCpfFilter('');
    setStatusFilter('');
    setFilters({
      page: 1,
      limit: 20,
      order_by: 'full_name',
      order: 'ASC'
    });
  };

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedEmployee(null);
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage + 1 }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters(prev => ({ ...prev, page: 1, limit: newPageSize }));
  };

  const getStatusChip = (isActive: boolean) => {
    return (
      <Chip
        label={isActive ? 'Ativo' : 'Inativo'}
        color={isActive ? 'success' : 'default'}
        size="small"
        icon={isActive ? <CheckCircle /> : <Cancel />}
      />
    );
  };

  const columns: GridColDef[] = [
    {
      field: 'full_name',
      headerName: 'Nome Completo',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            {params.value?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'cpf',
      headerName: 'CPF',
      width: 140,
      renderCell: (params) => {
        const cpf = params.value || '';
        const formatted = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return <Typography variant="body2">{formatted}</Typography>;
      },
    },
    {
      field: 'job_title',
      headerName: 'Cargo',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person fontSize="small" color="action" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'department',
      headerName: 'Departamento',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Business fontSize="small" color="action" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'cost_center',
      headerName: 'Centro de Custo',
      width: 130,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalance fontSize="small" color="action" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => getStatusChip(params.value === 'A'),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Ações',
      width: 80,
      getActions: (params) => [
        <GridActionsCellItem
          key="view"
          icon={
            <Tooltip title="Ver detalhes">
              <Visibility />
            </Tooltip>
          }
          label="Ver detalhes"
          onClick={() => handleViewDetails(params.row)}
        />,
      ],
    },
  ];

  const rows: GridRowsProp = employees.map((employee) => ({
    ...employee,
  }));

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Gestão de Colaboradores
      </Typography>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Buscar por nome"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="CPF"
              variant="outlined"
              size="small"
              value={cpfFilter}
              onChange={(e) => setCpfFilter(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | '')}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
                startIcon={<Search />}
              >
                Buscar
              </Button>
              <Button
                variant="outlined"
                onClick={handleClearFilters}
                startIcon={<FilterList />}
              >
                Limpar
              </Button>
              <IconButton onClick={loadEmployees} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Lista de Colaboradores */}
      <Paper sx={{ height: 600, width: '100%' }}>
        {error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pagination
            paginationMode="server"
            getRowId={(row) => row.id || row.employee_id || `emp_${Math.random()}`}
            initialState={{
              pagination: {
                paginationModel: {
                  page: pagination.page - 1,
                  pageSize: pagination.limit,
                },
              },
            }}
            rowCount={pagination.total}
            pageSizeOptions={[10, 20, 50, 100]}
            onPaginationModelChange={(model) => {
              handlePageChange(model.page);
              handlePageSizeChange(model.pageSize);
            }}
            disableRowSelectionOnClick
            localeText={{
              noRowsLabel: 'Nenhum colaborador encontrado',
              footerRowSelected: (count) => `${count} linha(s) selecionada(s)`,
              footerTotalRows: 'Total de linhas:',
              footerTotalVisibleRows: (visibleCount, totalCount) =>
                `${visibleCount} de ${totalCount}`,
            }}
            sx={{
              '& .MuiDataGrid-row:hover': {
                backgroundColor: alpha('#1976d2', 0.04),
              },
            }}
          />
        )}
      </Paper>

      {/* Dialog de Detalhes */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        {selectedEmployee && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Person />
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedEmployee.full_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(selectedEmployee as any).job_title}
                  </Typography>
                </Box>
                <Box sx={{ ml: 'auto' }}>
                  {getStatusChip((selectedEmployee as any).status === 'A')}
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Informações Pessoais
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>ID do Funcionário:</strong> {(selectedEmployee as any).employee_id}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>CPF:</strong> {selectedEmployee.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Cargo:</strong> {(selectedEmployee as any).job_title}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Data de Admissão:</strong> {(selectedEmployee as any).admission_date ? format(new Date((selectedEmployee as any).admission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Informações Organizacionais
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Departamento:</strong> {selectedEmployee.department}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Centro de Custo:</strong> {(selectedEmployee as any).cost_center}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Filial:</strong> {(selectedEmployee as any).branch_name}
                    </Typography>
                    {(selectedEmployee as any).termination_date && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Data de Demissão:</strong> {format(new Date((selectedEmployee as any).termination_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Informações do Sistema
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Status:</strong> {(selectedEmployee as any).status === 'A' ? 'Ativo' : 'Inativo'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>ID da Filial:</strong> {(selectedEmployee as any).branch_id}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails}>Fechar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Snackbar para mensagens */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmployeesPage;