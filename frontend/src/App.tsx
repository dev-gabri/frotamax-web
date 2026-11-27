import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import InicioPage from './pages/InicioPage';
import VehiclesPage from './pages/VehiclesPage';
import DriversPage from './pages/DriversPage';
import ReservationsPage from './pages/ReservationsPage';

const App: React.FC = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <InicioPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos"
        element={
          <ProtectedRoute>
            <Layout>
              <VehiclesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/condutores"
        element={
          <ProtectedRoute>
            <Layout>
              <DriversPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservas"
        element={
          <ProtectedRoute>
            <Layout>
              <ReservationsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
};

export default App;
