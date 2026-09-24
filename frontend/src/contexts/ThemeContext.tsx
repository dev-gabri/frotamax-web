import React, { createContext, useContext, useState, ReactNode } from 'react';
import { createTheme, ThemeProvider, Theme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { UserSettings } from '../types';

interface ThemeContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  theme: Theme;
  toggleMode: () => void;
  setColors: (primary: string, background: string) => void;
  resetToDefaults: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const defaultSettings: UserSettings = {
  theme_mode: 'light',
  theme_primary_color: '#1976d2',
  theme_background_color: '#f5f5f5'
};

export const CustomThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    // Load from localStorage on initialization
    const saved = localStorage.getItem('frotamax_theme_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem('frotamax_theme_settings', JSON.stringify(updatedSettings));
  };

  const toggleMode = () => {
    updateSettings({
      theme_mode: settings.theme_mode === 'light' ? 'dark' : 'light'
    });
  };

  const setColors = (primary: string, background: string) => {
    updateSettings({
      theme_primary_color: primary,
      theme_background_color: background
    });
  };

  const resetToDefaults = () => {
    updateSettings(defaultSettings);
  };

  // Create Material-UI theme based on current settings
  const theme = createTheme({
    palette: {
      mode: settings.theme_mode,
      primary: {
        main: settings.theme_primary_color,
      },
      background: {
        default: settings.theme_mode === 'light' 
          ? settings.theme_background_color 
          : '#121212',
        paper: settings.theme_mode === 'light' 
          ? '#ffffff' 
          : '#1e1e1e',
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: settings.theme_mode === 'light' ? '#ffffff' : '#1e1e1e',
            color: settings.theme_mode === 'light' ? '#000000' : '#ffffff',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: settings.theme_mode === 'light' 
              ? '#f8f9fa' 
              : '#1e1e1e',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: settings.theme_mode === 'light' 
              ? '#ffffff' 
              : '#1e1e1e',
          },
        },
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 8,
    },
  });

  const value: ThemeContextType = {
    settings,
    updateSettings,
    theme,
    toggleMode,
    setColors,
    resetToDefaults,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a CustomThemeProvider');
  }
  return context;
};

export default ThemeContext;