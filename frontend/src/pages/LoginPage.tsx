import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Email, Lock, Login as LoginIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { brand } from '../theme';
import logo from '../assets/images/logo.png';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tela de acesso ao Frota Max Web (card S1-09).
 * Valida os campos antes do envio, mostra o retorno da API sem detalhes técnicos
 * e redireciona para a área solicitada após a autenticação.
 */
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({});

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { from?: string } | null)?.from || '/';

  const validar = () => {
    const novos: typeof erros = {};
    if (!email.trim()) novos.email = 'Informe o e-mail.';
    else if (!EMAIL_REGEX.test(email.trim())) novos.email = 'Informe um e-mail válido.';
    if (!senha) novos.senha = 'Informe a senha.';
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!validar()) return;
    setEnviando(true);
    try {
      await login(email.trim(), senha);
      navigate(destino, { replace: true });
    } catch (error) {
      setErro((error as Error).message);
      setSenha('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        background: `linear-gradient(160deg, ${brand.navy} 0%, ${brand.navyLight} 55%, #1d4f91 100%)`,
      }}
    >
      <Paper
        elevation={0}
        sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 5 }, borderRadius: 4, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
      >
        <Box textAlign="center" mb={3}>
          <img src={logo} alt="Logotipo Frota Max" style={{ width: 96, height: 'auto' }} />
          <Typography component="h1" variant="h5" mt={1}>
            Acessar o Frota Max
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestão da frota do Departamento de Frotas
          </Typography>
        </Box>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {erro}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            autoFocus
            required
            margin="normal"
            size="medium"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!erros.email}
            helperText={erros.email}
            disabled={enviando}
            InputProps={{ startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment> }}
          />
          <TextField
            label="Senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            required
            margin="normal"
            size="medium"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            error={!!erros.senha}
            helperText={erros.senha}
            disabled={enviando}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setMostrarSenha((v) => !v)}
                    edge="end"
                  >
                    {mostrarSenha ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={enviando}
            startIcon={enviando ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
            sx={{ mt: 3, py: 1.3 }}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={3}>
          Acesso restrito aos usuários autorizados do Departamento de Frotas.
        </Typography>
      </Paper>
    </Box>
  );
};

export default LoginPage;
