import React from 'react';
import { Alert, Typography } from '@mui/material';

/** Página reservada para o fluxo de gestão de veículos (card S1-05). */
const VehiclesPage: React.FC = () => (
  <>
    <Typography variant="h4" gutterBottom>Veículos</Typography>
    <Alert severity="info">A gestão de veículos será disponibilizada nesta área.</Alert>
  </>
);

export default VehiclesPage;
