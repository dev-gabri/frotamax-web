import React, { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Badge, DirectionsCar, EventNote, Home, Logout, Menu as MenuIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../types';
import { brand } from '../theme';
import logo from '../assets/images/logo-small.png';

const drawerWidth = 248;

/** Itens de menu disponíveis no incremento atual. Novos módulos entram conforme as sprints. */
const menuItems = [
  { text: 'Início', icon: <Home />, path: '/' },
  { text: 'Veículos', icon: <DirectionsCar />, path: '/veiculos' },
  { text: 'Condutores', icon: <Badge />, path: '/condutores' },
  { text: 'Reservas e empréstimos', icon: <EventNote />, path: '/reservas' },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#fff' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <img src={logo} alt="" width={36} height={36} />
        <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
          Frota<span style={{ color: '#7ED957' }}>Max</span>
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
      <List component="nav" aria-label="Menu principal" sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const selected = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: 'rgba(255,255,255,0.85)',
                '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 40 },
                '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: brand.blue, color: '#fff' },
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                '&.Mui-focusVisible': { outline: '2px solid #fff' },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ px: 1.5, pb: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{ borderRadius: 2, color: 'rgba(255,255,255,0.85)', '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 40 } }}
        >
          <ListItemIcon><Logout /></ListItemIcon>
          <ListItemText primary="Sair" />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: '#fff',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="Abrir menu"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.nome}</Typography>
                <Typography variant="caption" color="text.secondary">{ROLE_LABELS[user.perfil]}</Typography>
              </Box>
              <Tooltip title={`${user.nome} — ${ROLE_LABELS[user.perfil]}`}>
                <Avatar sx={{ bgcolor: brand.navy, width: 36, height: 36 }}>
                  {user.nome.charAt(0).toUpperCase()}
                </Avatar>
              </Tooltip>
              <Chip
                label={ROLE_LABELS[user.perfil]}
                size="small"
                sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
              />
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: brand.navy,
              borderRight: 'none',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          backgroundColor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
