import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  PhotoCamera as PhotoCameraIcon,
  Lock as LockIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { ProfileService } from '../services/profileService';
import { PasswordChange } from '../types';

const ProfilePage: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });

  const [profileData, setProfileData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    department: profile?.department || '',
    cost_center: profile?.cost_center || ''
  });

  const [passwordData, setPasswordData] = useState<PasswordChange>({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [passwordErrors, setPasswordErrors] = useState<Partial<PasswordChange>>({});

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        department: profile.department || '',
        cost_center: profile.cost_center || ''
      });
    }
  }, [profile]);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleProfileSubmit = async () => {
    try {
      setLoading(true);
      const response = await ProfileService.updateProfile(profileData);
      
      if (response.success && response.data) {
        updateProfile(response.data);
        setEditMode(false);
        showSnackbar('Perfil atualizado com sucesso!', 'success');
      } else {
        showSnackbar(response.error || 'Erro ao atualizar perfil', 'error');
      }
    } catch (error) {
      showSnackbar('Erro ao atualizar perfil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        showSnackbar('Arquivo muito grande. Máximo 5MB.', 'error');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        showSnackbar('Apenas arquivos de imagem são permitidos.', 'error');
        return;
      }

      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    try {
      setLoading(true);
      const response = await ProfileService.uploadAvatar(avatarFile);
      
      if (response.success && response.data) {
        updateProfile({ avatar_url: response.data.avatar_url });
        setAvatarFile(null);
        setAvatarPreview(null);
        showSnackbar('Avatar atualizado com sucesso!', 'success');
      } else {
        showSnackbar(response.error || 'Erro ao fazer upload do avatar', 'error');
      }
    } catch (error) {
      showSnackbar('Erro ao fazer upload do avatar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (): boolean => {
    const errors: Partial<PasswordChange> = {};

    if (!passwordData.current_password) {
      errors.current_password = 'Senha atual é obrigatória';
    }

    if (!passwordData.new_password) {
      errors.new_password = 'Nova senha é obrigatória';
    } else if (passwordData.new_password.length < 6) {
      errors.new_password = 'Nova senha deve ter pelo menos 6 caracteres';
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      errors.confirm_password = 'Senhas não coincidem';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async () => {
    if (!validatePassword()) return;

    try {
      setLoading(true);
      const response = await ProfileService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      
      if (response.success) {
        setPasswordDialogOpen(false);
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        setPasswordErrors({});
        showSnackbar('Senha alterada com sucesso!', 'success');
      } else {
        showSnackbar(response.error || 'Erro ao alterar senha', 'error');
      }
    } catch (error) {
      showSnackbar('Erro ao alterar senha', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarSrc = () => {
    if (avatarPreview) return avatarPreview;
    if (profile?.avatar_url) return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${profile.avatar_url}`;
    return undefined;
  };

  const getAvatarText = () => {
    return profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U';
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Meu Perfil
      </Typography>

      <Grid container spacing={3}>
        {/* Avatar Section */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box position="relative" display="inline-block" mb={2}>
                <Avatar
                  src={getAvatarSrc()}
                  sx={{
                    width: 120,
                    height: 120,
                    fontSize: '2rem',
                    margin: '0 auto'
                  }}
                >
                  {getAvatarText()}
                </Avatar>
                <Tooltip title="Alterar foto">
                  <IconButton
                    component="label"
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    }}
                  >
                    <PhotoCameraIcon />
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                  </IconButton>
                </Tooltip>
              </Box>

              <Typography variant="h6" gutterBottom>
                {profile?.full_name || 'Nome não informado'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
              <Typography variant="caption" display="block" mt={1}>
                {user?.role?.toUpperCase()}
              </Typography>

              {avatarFile && (
                <Box mt={2}>
                  <Button
                    variant="contained"
                    onClick={handleAvatarUpload}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  >
                    Salvar Avatar
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                    sx={{ ml: 1 }}
                  >
                    Cancelar
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Informações Pessoais
                </Typography>
                {!editMode && (
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => setEditMode(true)}
                  >
                    Editar
                  </Button>
                )}
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    helperText="Email não pode ser alterado"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nome Completo"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    disabled={!editMode}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Telefone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    disabled={!editMode}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Departamento"
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                    disabled={!editMode}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Centro de Custo"
                    value={profileData.cost_center}
                    onChange={(e) => setProfileData({ ...profileData, cost_center: e.target.value })}
                    disabled={!editMode}
                  />
                </Grid>
              </Grid>
            </CardContent>

            {editMode && (
              <CardActions>
                <Button
                  variant="contained"
                  onClick={handleProfileSubmit}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                >
                  Salvar
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditMode(false);
                    setProfileData({
                      full_name: profile?.full_name || '',
                      phone: profile?.phone || '',
                      department: profile?.department || '',
                      cost_center: profile?.cost_center || ''
                    });
                  }}
                  startIcon={<CancelIcon />}
                >
                  Cancelar
                </Button>
              </CardActions>
            )}
          </Card>

          {/* Security Section */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Segurança
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Mantenha sua conta segura alterando sua senha regularmente.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={() => setPasswordDialogOpen(true)}
              >
                Alterar Senha
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Password Change Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Alterar Senha</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Senha Atual"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                error={!!passwordErrors.current_password}
                helperText={passwordErrors.current_password}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Nova Senha"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                error={!!passwordErrors.new_password}
                helperText={passwordErrors.new_password}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Confirmar Nova Senha"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                error={!!passwordErrors.confirm_password}
                helperText={passwordErrors.confirm_password}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPasswordDialogOpen(false);
              setPasswordData({
                current_password: '',
                new_password: '',
                confirm_password: ''
              });
              setPasswordErrors({});
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordSubmit}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Alterar Senha'}
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

export default ProfilePage;