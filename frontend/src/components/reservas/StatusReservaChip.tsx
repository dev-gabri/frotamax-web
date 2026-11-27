import React from 'react';
import { Chip, Stack } from '@mui/material';
import { Cancel, CheckCircle, DirectionsCar, Schedule, WarningAmber } from '@mui/icons-material';
import { STATUS_RESERVA_LABELS, StatusReserva } from '../../types';

/** Status da reserva por ícone + texto + cor; devolução atrasada recebe um aviso próprio. */
const CONFIG: Record<StatusReserva, { color: 'info' | 'primary' | 'default' | 'success'; icon: React.ReactElement }> = {
  agendada: { color: 'info', icon: <Schedule /> },
  em_uso: { color: 'primary', icon: <DirectionsCar /> },
  cancelada: { color: 'default', icon: <Cancel /> },
  concluida: { color: 'success', icon: <CheckCircle /> },
};

const StatusReservaChip: React.FC<{ status: StatusReserva; atrasada?: boolean }> = ({ status, atrasada }) => {
  const { color, icon } = CONFIG[status];
  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap">
      <Chip size="small" variant="outlined" color={color} icon={icon} label={STATUS_RESERVA_LABELS[status]} sx={{ fontWeight: 600 }} />
      {atrasada && <Chip size="small" color="error" icon={<WarningAmber />} label="Devolução atrasada" sx={{ fontWeight: 600 }} />}
    </Stack>
  );
};

export default StatusReservaChip;
