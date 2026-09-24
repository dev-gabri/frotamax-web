import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  DirectionsCar,
  Person,
  EventNote,
  People,
  Assessment,
  AccountCircle,
  Logout,
  Notifications,
  Settings,
  ManageAccounts,
  Assignment,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { user, profile, logout, hasRole } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { 
      text: 'Dashboard', 
      icon: <Dashboard />, 
      path: '/dashboard',
      roles: ['admin', 'gestor_frota', 'rh', 'condutor', 'visualizador']
    },
    { 
      text: 'Veículos', 
      icon: <DirectionsCar />, 
      path: '/vehicles',
      roles: ['admin', 'gestor_frota', 'condutor', 'visualizador']
    },
    { 
      text: 'Condutores', 
      icon: <Person />, 
      path: '/drivers',
      roles: ['admin', 'gestor_frota']
    },
    { 
      text: 'Atribuições', 
      icon: <Assignment />, 
      path: '/assignments',
      roles: ['admin', 'gestor_frota']
    },
    { 
      text: 'Reservas', 
      icon: <EventNote />, 
      path: '/reservations',
      roles: ['admin', 'gestor_frota', 'condutor']
    },
    { 
      text: 'Colaboradores', 
      icon: <People />, 
      path: '/employees',
      roles: ['admin', 'rh', 'gestor_frota']
    },
    { 
      text: 'Usuários', 
      icon: <ManageAccounts />, 
      path: '/users',
      roles: ['admin', 'gestor_frota']
    },
    { 
      text: 'Relatórios', 
      icon: <Assessment />, 
      path: '/reports',
      roles: ['admin', 'gestor_frota', 'visualizador']
    },
  ];

  const drawer = (
    <Box>
      <Toolbar>
        <Box display="flex" alignItems="center" gap={1}>
          <img 
            src="/src/assets/images/logo-small.png" 
            alt="FrotaMax" 
            style={{
              maxWidth: '32px',
              maxHeight: '32px',
              width: 'auto',
              height: 'auto'
            }}
          />
          <Typography variant="h6" noWrap component="div" fontWeight="bold">
            FrotaMax
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => {
          if (!hasRole(item.roles)) return null;
          
          const isActive = location.pathname === item.path;
          
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => navigate(item.path)}
                selected={isActive}
                sx={{
                  mx: 1,
                  my: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: 'white',
          color: 'text.primary',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'FrotaMax'}
          </Typography>

          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={0} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar 
              src={profile?.avatar_url ? `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${profile.avatar_url}` : undefined}
              sx={{ width: 32, height: 32 }}
            >
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              Perfil
            </MenuItem>
            <MenuItem onClick={() => { navigate('/settings'); handleProfileMenuClose(); }}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              Configurações
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#f8f9fa',
              borderRight: '1px solid rgba(0, 0, 0, 0.1)',
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
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: '#f5f5f5',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;