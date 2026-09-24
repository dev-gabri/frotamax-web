import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ReportsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Relatórios e Análises
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>
          Página de relatórios em desenvolvimento...
        </Typography>
      </Paper>
    </Box>
  );
};

export default ReportsPage;