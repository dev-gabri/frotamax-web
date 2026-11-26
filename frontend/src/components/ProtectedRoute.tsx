import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

/** Impede a navegação para áreas restritas sem sessão válida. */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !hasRole(roles)) {
    return (
      <Box p={3}>
        <Alert severity="error">Você não tem permissão para acessar esta página.</Alert>
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
