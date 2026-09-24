import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  IconButton,
  Tooltip,
  Grid,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  VpnKey as VpnKeyIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  account_status: string;
  created_at: string;
  user_profiles?: {
    full_name: string;
    department?: string;
    cost_center?: string;
  }[];
}

interface Driver {
  id: string;
  full_name: string;
  email: string;
  cpf: string;
  system_access_enabled: boolean;
  is_active: boolean;
}

const UsersManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Search states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  
  // Dialog states
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [openDriverAccessDialog, setOpenDriverAccessDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  
  // Form states
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: '',
    department: '',
    cost_center: ''
  });
  const [initialPassword, setInitialPassword] = useState('');
  
  // Edit user dialog states
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);

  const roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'gestor_frota', label: 'Gestor de Frota' },
    { value: 'rh', label: 'Recursos Humanos' },
    { value: 'visualizador', label: 'Visualizador' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'pending_activation': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'pending_activation': return 'Pendente';
      case 'suspended': return 'Suspenso';
      default: return status;
    }
  };

  const getRoleLabel = (role: string) => {
    const roleObj = roles.find(r => r.value === role);
    return roleObj ? roleObj.label : role;
  };

  const fetchUsers = async () => {
    try {
      const response = await apiService.get('/users');
      if (response.success) {
        const userData = (response.data as User[]) || [];
        setUsers(userData);
        setFilteredUsers(userData);
      } else {
        setError(response.error || 'Erro ao carregar usuários');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    }
  };

  const fetchDriversPendingAccess = async () => {
    try {
      const response = await apiService.get('/auth/drivers-pending-access');
      if (response.success) {
        const driverData = (response.data as Driver[]) || [];
        setDrivers(driverData);
        setFilteredDrivers(driverData);
      } else {
        setError(response.error || 'Erro ao carregar condutores');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    }
  };

  const handleCreateUser = async () => {
    try {
      setError(null);
      
      const response = await apiService.post('/auth/register', userForm);
      if (response.success) {
        setSuccess('Usuário criado com sucesso');
        setOpenUserDialog(false);
        setUserForm({ email: '', password: '', full_name: '', role: '', department: '', cost_center: '' });
        fetchUsers();
      } else {
        setError(response.error || 'Erro ao criar usuário');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    }
  };

  const handleEnableDriverAccess = async () => {
    if (!selectedDriver || !initialPassword) {
      setError('Selecione um condutor e defina uma senha inicial');
      return;
    }

    try {
      setError(null);
      
      const response = await apiService.post('/auth/enable-driver-access', {
        driver_id: selectedDriver.id,
        initial_password: initialPassword
      });

      if (response.success) {
        setSuccess(`Acesso habilitado para ${selectedDriver.full_name}`);
        setOpenDriverAccessDialog(false);
        setSelectedDriver(null);
        setInitialPassword('');
        fetchDriversPendingAccess();
      } else {
        setError(response.error || 'Erro ao habilitar acesso');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleEditUser = () => {
    // TODO: Implement user editing functionality
    setError('Funcionalidade de edição em desenvolvimento');
    setOpenEditDialog(false);
  };

  const handleResetPassword = () => {
    // TODO: Implement password reset functionality  
    setError('Funcionalidade de redefinição de senha em desenvolvimento');
    setOpenPasswordDialog(false);
  };

  // Filter users based on search term
  const filterUsers = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }
    
    const filtered = users.filter(user => {
      const fullName = user.user_profiles?.[0]?.full_name || '';
      const email = user.email || '';
      const role = getRoleLabel(user.role) || '';
      const department = user.user_profiles?.[0]?.department || '';
      
      const searchLower = searchTerm.toLowerCase();
      return (
        fullName.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        role.toLowerCase().includes(searchLower) ||
        department.toLowerCase().includes(searchLower)
      );
    });
    
    setFilteredUsers(filtered);
  };

  // Filter drivers based on search term
  const filterDrivers = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredDrivers(drivers);
      return;
    }
    
    const filtered = drivers.filter(driver => {
      const searchLower = searchTerm.toLowerCase();
      return (
        driver.full_name.toLowerCase().includes(searchLower) ||
        driver.email.toLowerCase().includes(searchLower) ||
        driver.cpf.includes(searchTerm)
      );
    });
    
    setFilteredDrivers(filtered);
  };

  // Handle user search
  const handleUserSearch = (term: string) => {
    setUserSearchTerm(term);
    filterUsers(term);
  };

  // Handle driver search
  const handleDriverSearch = (term: string) => {
    setDriverSearchTerm(term);
    filterDrivers(term);
  };

  // Clear user search
  const clearUserSearch = () => {
    setUserSearchTerm('');
    setFilteredUsers(users);
  };

  // Clear driver search
  const clearDriverSearch = () => {
    setDriverSearchTerm('');
    setFilteredDrivers(drivers);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (tabValue === 0) {
        await fetchUsers();
      } else {
        await fetchDriversPendingAccess();
      }
      setLoading(false);
    };
    
    loadData();
  }, [tabValue]);

  if (!user || (user.role !== 'admin' && user.role !== 'gestor_frota')) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Você não tem permissão para acessar esta página.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Gerenciamento de Usuários
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Usuários do Sistema" />
            <Tab label="Ativação de Condutores" />
          </Tabs>

          {tabValue === 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Usuários do Sistema
                </Typography>
                {user.role === 'admin' && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenUserDialog(true)}
                  >
                    Novo Usuário
                  </Button>
                )}
              </Box>

              {/* Search bar for users */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Buscar usuários por nome, email, função ou departamento..."
                  value={userSearchTerm}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                    ),
                    endAdornment: userSearchTerm && (
                      <IconButton onClick={clearUserSearch} size="small">
                        <ClearIcon />
                      </IconButton>
                    )
                  }}
                  sx={{ maxWidth: 600 }}
                />
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Função</TableCell>
                      <TableCell>Departamento</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Criado em</TableCell>
                      <TableCell>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((userItem) => (
                      <TableRow key={userItem.id}>
                        <TableCell>{userItem.user_profiles?.[0]?.full_name || 'Sem perfil'}</TableCell>
                        <TableCell>{userItem.email}</TableCell>
                        <TableCell>{getRoleLabel(userItem.role)}</TableCell>
                        <TableCell>{userItem.user_profiles?.[0]?.department || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(userItem.account_status)}
                            color={getStatusColor(userItem.account_status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(userItem.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Editar">
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setSelectedUser(userItem);
                                setOpenEditDialog(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Redefinir Senha">
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setSelectedUser(userItem);
                                setOpenPasswordDialog(true);
                              }}
                            >
                              <VpnKeyIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          {userSearchTerm ? 'Nenhum usuário encontrado para o termo buscado' : 'Nenhum usuário encontrado'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {tabValue === 1 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Condutores Aguardando Ativação
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchDriversPendingAccess}
                >
                  Atualizar
                </Button>
              </Box>

              {/* Search bar for drivers */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Buscar condutores por nome, email ou CPF..."
                  value={driverSearchTerm}
                  onChange={(e) => handleDriverSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                    ),
                    endAdornment: driverSearchTerm && (
                      <IconButton onClick={clearDriverSearch} size="small">
                        <ClearIcon />
                      </IconButton>
                    )
                  }}
                  sx={{ maxWidth: 600 }}
                />
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>CPF</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDrivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell>{driver.full_name}</TableCell>
                        <TableCell>{driver.email}</TableCell>
                        <TableCell>{driver.cpf}</TableCell>
                        <TableCell>
                          <Chip
                            label="Aguardando Ativação"
                            color="warning"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Habilitar Acesso ao Sistema">
                            <IconButton
                              color="primary"
                              onClick={() => {
                                setSelectedDriver(driver);
                                setOpenDriverAccessDialog(true);
                              }}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDrivers.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          {driverSearchTerm ? 'Nenhum condutor encontrado para o termo buscado' : 'Nenhum condutor aguardando ativação'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog para criar novo usuário */}
      <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criar Novo Usuário</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome Completo"
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Senha"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Função</InputLabel>
                <Select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  label="Função"
                >
                  {roles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Departamento"
                value={userForm.department}
                onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Centro de Custo"
                value={userForm.cost_center}
                onChange={(e) => setUserForm({ ...userForm, cost_center: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUserDialog(false)}>Cancelar</Button>
          <Button onClick={handleCreateUser} variant="contained">
            Criar Usuário
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para habilitar acesso do condutor */}
      <Dialog open={openDriverAccessDialog} onClose={() => setOpenDriverAccessDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Habilitar Acesso ao Sistema</DialogTitle>
        <DialogContent>
          {selectedDriver && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Condutor:</strong> {selectedDriver.full_name}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Email:</strong> {selectedDriver.email}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  label="Senha Inicial"
                  type="password"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  helperText="O condutor deverá alterar esta senha no primeiro acesso"
                />
                <Button
                  variant="outlined"
                  onClick={() => setInitialPassword(generateRandomPassword())}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  Gerar
                </Button>
              </Box>
              
              <Alert severity="info">
                Uma conta de usuário será criada automaticamente para este condutor com a função "Condutor".
                O condutor receberá as credenciais e deverá alterar a senha no primeiro acesso.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDriverAccessDialog(false)}>Cancelar</Button>
          <Button onClick={handleEnableDriverAccess} variant="contained">
            Habilitar Acesso
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para editar usuário */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Usuário</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Email:</strong> {selectedUser.email}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Função:</strong> {getRoleLabel(selectedUser.role)}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Status:</strong> {getStatusLabel(selectedUser.account_status)}
              </Typography>
              
              <Alert severity="info">
                Funcionalidade de edição será implementada em breve.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Fechar</Button>
          <Button onClick={handleEditUser} variant="contained" disabled>
            Salvar Alterações
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para redefinir senha */}
      <Dialog open={openPasswordDialog} onClose={() => setOpenPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Redefinir Senha</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Usuário:</strong> {selectedUser.user_profiles?.[0]?.full_name || selectedUser.email}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Email:</strong> {selectedUser.email}
              </Typography>
              
              <Alert severity="info">
                Funcionalidade de redefinição de senha será implementada em breve.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPasswordDialog(false)}>Fechar</Button>
          <Button onClick={handleResetPassword} variant="contained" disabled>
            Redefinir Senha
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManagementPage;