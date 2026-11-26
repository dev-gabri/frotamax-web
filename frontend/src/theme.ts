import { createTheme } from '@mui/material/styles';

/**
 * Identidade visual do Frota Max (cores do logotipo e dos mockups da proposta).
 */
export const brand = {
  navy: '#0B2545',
  navyLight: '#13315C',
  blue: '#1F5BD8',
  green: '#2E9E58',
  background: '#F4F6FA',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.blue },
    secondary: { main: brand.green },
    success: { main: brand.green },
    background: { default: brand.background, paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCard: { styleOverrides: { root: { boxShadow: '0 1px 3px rgba(16,24,40,0.08)' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
  },
});
