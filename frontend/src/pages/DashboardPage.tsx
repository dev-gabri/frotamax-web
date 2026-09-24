import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  DirectionsCar,
  Person,
  EventNote,
  Warning,
  MoreVert,
  CheckCircle,
  Cancel,
  Schedule,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const DashboardPage: React.FC = () => {
  // Mock data - in real app, this would come from API
  const stats = {
    totalVehicles: 45,
    availableVehicles: 28,
    vehiclesInUse: 12,
    vehiclesInMaintenance: 5,
    totalDrivers: 67,
    activeReservations: 15,
    pendingApprovals: 8,
    documentsExpiringSoon: 3,
  };

  const fleetStatusData = [
    { name: 'Disponível', value: stats.availableVehicles, color: '#4caf50' },
    { name: 'Em Uso', value: stats.vehiclesInUse, color: '#ff9800' },
    { name: 'Manutenção', value: stats.vehiclesInMaintenance, color: '#f44336' },
  ];

  const departmentUsage = [
    { department: 'Vendas', usage: 85, vehicles: 12 },
    { department: 'Operações', usage: 70, vehicles: 8 },
    { department: 'Logística', usage: 90, vehicles: 15 },
    { department: 'Administração', usage: 40, vehicles: 6 },
    { department: 'Manutenção', usage: 60, vehicles: 4 },
  ];

  const recentAlerts = [
    { id: 1, type: 'warning', message: 'CNH de João Silva expira em 7 dias', time: '2h atrás' },
    { id: 2, type: 'error', message: 'Veículo ABC-1234 precisa de revisão', time: '4h atrás' },
    { id: 3, type: 'info', message: 'Nova reserva aguardando aprovação', time: '6h atrás' },
    { id: 4, type: 'success', message: 'Documento de Maria Santos renovado', time: '8h atrás' },
  ];

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Cancel color="error" />;
      case 'success':
        return <CheckCircle color="success" />;
      default:
        return <Schedule color="info" />;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total de Veículos"
            value={stats.totalVehicles}
            icon={<DirectionsCar />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Condutores Ativos"
            value={stats.totalDrivers}
            icon={<Person />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Reservas Ativas"
            value={stats.activeReservations}
            icon={<EventNote />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Alertas Pendentes"
            value={stats.documentsExpiringSoon}
            icon={<Warning />}
            color="error.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Fleet Status Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Status da Frota
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fleetStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fleetStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Department Usage */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Utilização por Departamento
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="usage" fill="#1976d2" name="% Utilização" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Alerts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold">
                Alertas Recentes
              </Typography>
              <IconButton size="small">
                <MoreVert />
              </IconButton>
            </Box>
            <List>
              {recentAlerts.map((alert) => (
                <ListItem key={alert.id} disablePadding>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {getAlertIcon(alert.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={alert.message}
                    secondary={alert.time}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Ações Rápidas
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6">
                          Aprovações Pendentes
                        </Typography>
                        <Typography variant="h4" fontWeight="bold">
                          {stats.pendingApprovals}
                        </Typography>
                      </Box>
                      <EventNote fontSize="large" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6">
                          Documentos Vencendo
                        </Typography>
                        <Typography variant="h4" fontWeight="bold">
                          {stats.documentsExpiringSoon}
                        </Typography>
                      </Box>
                      <Warning fontSize="large" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;