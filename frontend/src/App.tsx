import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import FirstLoginPage from './pages/FirstLoginPage';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import DriversPage from './pages/DriversPage';
import ReservationsPage from './pages/ReservationsPage';
import EmployeesPage from './pages/EmployeesPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import UsersManagementPage from './pages/UsersManagementPage';
import DataImportPage from './pages/DataImportPage';
import AssignmentsPage from './pages/AssignmentsPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={50} />
      </Box>
    );
  }

  // Check if user needs to change password on first login
  const needsFirstLogin = isAuthenticated && user && (user as any).first_login_required;

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            needsFirstLogin ? <Navigate to="/first-login" replace /> : <Navigate to="/dashboard" replace />
          ) : <LoginPage />
        } 
      />

      <Route 
        path="/first-login" 
        element={
          isAuthenticated ? (
            needsFirstLogin ? <FirstLoginPage /> : <Navigate to="/dashboard" replace />
          ) : <Navigate to="/login" replace />
        } 
      />
      
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            needsFirstLogin ? <Navigate to="/first-login" replace /> : <Navigate to="/dashboard" replace />
          ) : <Navigate to="/login" replace />
        } 
      />
      
      <Route 
        path="/*" 
        element={
          !isAuthenticated ? <Navigate to="/login" replace /> : (
            needsFirstLogin ? <Navigate to="/first-login" replace /> : (
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/vehicles" element={<VehiclesPage />} />
                    <Route path="/drivers" element={<DriversPage />} />
                    <Route path="/reservations" element={<ReservationsPage />} />
                    <Route 
                      path="/employees" 
                      element={
                        <ProtectedRoute roles={['admin', 'rh', 'gestor_frota']}>
                          <EmployeesPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/users" 
                      element={
                        <ProtectedRoute roles={['admin', 'gestor_frota']}>
                          <UsersManagementPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/reports" 
                      element={
                        <ProtectedRoute roles={['admin', 'gestor_frota', 'visualizador']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route 
                      path="/data-import" 
                      element={
                        <ProtectedRoute roles={['admin', 'gestor_frota']}>
                          <DataImportPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/assignments" 
                      element={
                        <ProtectedRoute roles={['admin', 'gestor_frota']}>
                          <AssignmentsPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            )
          )
        } 
      />
    </Routes>
  );
};

export default App;