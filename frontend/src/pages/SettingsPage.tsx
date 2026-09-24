import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { HexColorPicker } from 'react-colorful';
import { useTheme } from '../contexts/ThemeContext';
import { ProfileService } from '../services/profileService';
import { UserSettings } from '../types';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetToDefaults } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempSettings, setTempSettings] = useState<UserSettings>(settings);
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await ProfileService.getSettings();
      
      if (response.success && response.data) {
        updateSettings(response.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showSnackbar('Erro ao carregar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await ProfileService.updateSettings(tempSettings);
      
      if (response.success && response.data) {
        updateSettings(response.data);
        showSnackbar('Configurações salvas com sucesso!', 'success');
      } else {
        showSnackbar(response.error || 'Erro ao salvar configurações', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar('Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleModeToggle = () => {
    const newMode = tempSettings.theme_mode === 'light' ? 'dark' : 'light';
    setTempSettings({ ...tempSettings, theme_mode: newMode });
    updateSettings({ theme_mode: newMode }); // Apply immediately for preview
  };

  const handlePrimaryColorChange = (color: string) => {
    setTempSettings({ ...tempSettings, theme_primary_color: color });
    updateSettings({ theme_primary_color: color }); // Apply immediately for preview
  };

  const handleBackgroundColorChange = (color: string) => {
    setTempSettings({ ...tempSettings, theme_background_color: color });
    updateSettings({ theme_background_color: color }); // Apply immediately for preview
  };

  const handleReset = () => {
    setTempSettings({
      theme_mode: 'light',
      theme_primary_color: '#1976d2',
      theme_background_color: '#f5f5f5'
    });
    resetToDefaults();
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(tempSettings);

  const predefinedColors = [
    { name: 'Azul', color: '#1976d2' },
    { name: 'Verde', color: '#2e7d32' },
    { name: 'Roxo', color: '#7b1fa2' },
    { name: 'Laranja', color: '#ed6c02' },
    { name: 'Vermelho', color: '#d32f2f' },
    { name: 'Teal', color: '#0288d1' },
    { name: 'Indigo', color: '#303f9f' },
    { name: 'Rosa', color: '#c2185b' }
  ];

  const backgroundColors = [
    { name: 'Claro', color: '#f5f5f5' },
    { name: 'Branco', color: '#ffffff' },
    { name: 'Cinza Claro', color: '#fafafa' },
    { name: 'Azul Claro', color: '#f0f8ff' },
    { name: 'Verde Claro', color: '#f0fff0' },
    { name: 'Creme', color: '#fffdd0' }
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Configurações
      </Typography>

      <Grid container spacing={3}>
        {/* Theme Mode */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                {tempSettings.theme_mode === 'light' ? (
                  <LightModeIcon sx={{ mr: 1, color: 'primary.main' }} />
                ) : (
                  <DarkModeIcon sx={{ mr: 1, color: 'primary.main' }} />
                )}
                <Typography variant="h6">
                  Modo do Tema
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Escolha entre o modo claro ou escuro para a interface.
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={tempSettings.theme_mode === 'dark'}
                    onChange={handleModeToggle}
                    color="primary"
                  />
                }
                label={tempSettings.theme_mode === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Primary Color */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <PaletteIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  Cor Principal
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" paragraph>
                Escolha a cor principal que será usada em botões, links e destaques.
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {predefinedColors.map((colorOption) => (
                  <Tooltip key={colorOption.name} title={colorOption.name}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: colorOption.color,
                        borderRadius: 1,
                        cursor: 'pointer',
                        border: tempSettings.theme_primary_color === colorOption.color 
                          ? '3px solid #000' 
                          : '1px solid #ccc',
                        '&:hover': {
                          transform: 'scale(1.1)'
                        }
                      }}
                      onClick={() => handlePrimaryColorChange(colorOption.color)}
                    />
                  </Tooltip>
                ))}
              </Box>

              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                startIcon={<PaletteIcon />}
              >
                Cor Personalizada
              </Button>

              {showPrimaryPicker && (
                <Box mt={2}>
                  <HexColorPicker
                    color={tempSettings.theme_primary_color}
                    onChange={handlePrimaryColorChange}
                  />
                  <Typography variant="caption" display="block" mt={1}>
                    Cor atual: {tempSettings.theme_primary_color}
                  </Typography>
                </Box>
              )}

              <Box mt={2}>
                <Chip
                  label="Prévia"
                  sx={{
                    backgroundColor: tempSettings.theme_primary_color,
                    color: 'white'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Background Color (Light Mode Only) */}
        {tempSettings.theme_mode === 'light' && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cor de Fundo
                </Typography>

                <Typography variant="body2" color="text.secondary" paragraph>
                  Escolha a cor de fundo para o modo claro.
                </Typography>

                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {backgroundColors.map((colorOption) => (
                    <Tooltip key={colorOption.name} title={colorOption.name}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: colorOption.color,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: tempSettings.theme_background_color === colorOption.color 
                            ? '3px solid #000' 
                            : '1px solid #ccc',
                          '&:hover': {
                            transform: 'scale(1.1)'
                          }
                        }}
                        onClick={() => handleBackgroundColorChange(colorOption.color)}
                      />
                    </Tooltip>
                  ))}
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
                  startIcon={<PaletteIcon />}
                >
                  Cor Personalizada
                </Button>

                {showBackgroundPicker && (
                  <Box mt={2}>
                    <HexColorPicker
                      color={tempSettings.theme_background_color}
                      onChange={handleBackgroundColorChange}
                    />
                    <Typography variant="caption" display="block" mt={1}>
                      Cor atual: {tempSettings.theme_background_color}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Preview Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Prévia do Tema
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Veja como ficará a aparência com as configurações atuais.
              </Typography>

              <Paper
                sx={{
                  p: 3,
                  backgroundColor: tempSettings.theme_mode === 'light' 
                    ? tempSettings.theme_background_color 
                    : '#121212',
                  color: tempSettings.theme_mode === 'light' ? '#000' : '#fff'
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Exemplo de Card
                </Typography>
                <Typography variant="body2" paragraph>
                  Este é um exemplo de como o conteúdo aparecerá com o tema selecionado.
                </Typography>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: tempSettings.theme_primary_color,
                    color: 'white',
                    mr: 1
                  }}
                >
                  Botão Principal
                </Button>
                <Button variant="outlined">
                  Botão Secundário
                </Button>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12}>
          <Card>
            <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
              <Box>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  startIcon={<RefreshIcon />}
                  sx={{ mr: 1 }}
                >
                  Restaurar Padrão
                </Button>
                <Button
                  variant="outlined"
                  onClick={loadSettings}
                  startIcon={<RefreshIcon />}
                >
                  Recarregar
                </Button>
              </Box>

              <Button
                variant="contained"
                onClick={saveSettings}
                disabled={!hasChanges || saving}
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

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

export default SettingsPage;