import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Paper
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock as LockIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const FirstLoginPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return 'A senha deve ter pelo menos 6 caracteres';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'A senha deve conter pelo menos uma letra minúscula';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'A senha deve conter pelo menos uma letra maiúscula';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'A senha deve conter pelo menos um número';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!newPassword || !confirmPassword) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/change-first-login-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('frotamax_token')}`
        },
        body: JSON.stringify({
          new_password: newPassword
        })
      });

      if (response.ok) {
        // Senha alterada com sucesso, redirecionar para dashboard
        navigate('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao alterar senha');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (/(?=.*[a-z])/.test(password)) strength++;
    if (/(?=.*[A-Z])/.test(password)) strength++;
    if (/(?=.*\d)/.test(password)) strength++;
    if (/(?=.*[@$!%*?&])/.test(password)) strength++;
    return strength;
  };

  const getStrengthLabel = (strength: number) => {
    switch (strength) {
      case 0:
      case 1: return { label: 'Muito Fraca', color: 'error' };
      case 2: return { label: 'Fraca', color: 'warning' };
      case 3: return { label: 'Média', color: 'info' };
      case 4: return { label: 'Forte', color: 'success' };
      case 5: return { label: 'Muito Forte', color: 'success' };
      default: return { label: '', color: 'info' };
    }
  };

  const strength = getPasswordStrength(newPassword);
  const strengthInfo = getStrengthLabel(strength);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        p: 2
      }}
    >
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 500 }}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <LockIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h5" component="h1">
                Primeiro Acesso
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              Por segurança, você deve alterar sua senha no primeiro acesso ao sistema.
            </Alert>

            {user && (
              <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Usuário:</strong> {user.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Função:</strong> {user.role === 'condutor' ? 'Condutor' : user.role}
                </Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Nova Senha"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                margin="normal"
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                helperText="Mínimo 6 caracteres, incluindo maiúscula, minúscula e número"
              />

              {newPassword && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Typography variant="body2" color={`${strengthInfo.color}.main`}>
                    Força da senha: {strengthInfo.label}
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 4,
                      backgroundColor: '#e0e0e0',
                      borderRadius: 2,
                      mt: 0.5
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(strength / 5) * 100}%`,
                        height: '100%',
                        backgroundColor: `${strengthInfo.color}.main`,
                        borderRadius: 2,
                        transition: 'width 0.3s'
                      }}
                    />
                  </Box>
                </Box>
              )}

              <TextField
                fullWidth
                label="Confirmar Nova Senha"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                error={confirmPassword !== '' && newPassword !== confirmPassword}
                helperText={
                  confirmPassword !== '' && newPassword !== confirmPassword
                    ? 'As senhas não coincidem'
                    : ''
                }
              />

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  size="large"
                >
                  {loading ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </Box>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="text"
                  onClick={handleLogout}
                  disabled={loading}
                >
                  Sair do Sistema
                </Button>
              </Box>
            </form>

            <Box sx={{ mt: 3, p: 2, backgroundColor: '#fff3cd', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Dicas para uma senha segura:</strong>
              </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    Use pelo menos 6 caracteres
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    Inclua letras maiúsculas e minúsculas
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    Adicione números e símbolos
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary">
                    Evite informações pessoais óbvias
                  </Typography>
                </li>
              </ul>
            </Box>
          </CardContent>
        </Card>
      </Paper>
    </Box>
  );
};

export default FirstLoginPage;