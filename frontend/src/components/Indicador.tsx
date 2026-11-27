import React from 'react';
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';

interface Props {
  titulo: string;
  valor?: number;
  /** Quando informado, mostra o percentual em relação ao total. */
  total?: number;
  rotuloTotal?: string;
  icone: React.ReactNode;
  cor: string;
}

/** Cartão de indicador usado no topo das telas (totais e quantidades por situação). */
const Indicador: React.FC<Props> = ({ titulo, valor, total, rotuloTotal = 'da frota', icone, cor }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ bgcolor: `${cor}1A`, color: cor, borderRadius: 2, p: 1.2, display: 'flex' }} aria-hidden>{icone}</Box>
      <Box>
        <Typography variant="body2" color="text.secondary">{titulo}</Typography>
        {valor === undefined ? <Skeleton width={40} height={36} /> : (
          <Typography variant="h5" component="p">{valor}</Typography>
        )}
        {total !== undefined && valor !== undefined && total > 0 && (
          <Typography variant="caption" color="text.secondary">{Math.round((valor / total) * 100)}% {rotuloTotal}</Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

export default Indicador;
