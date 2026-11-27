import React from 'react';
import { Chip } from '@mui/material';
import { CheckCircle, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { SITUACAO_CNH_LABELS, SituacaoCnh } from '../../types';

/** Situação da CNH por ícone + texto + cor (a informação não depende só da cor). */
const CONFIG: Record<SituacaoCnh, { color: 'success' | 'warning' | 'error'; icon: React.ReactElement }> = {
  valida: { color: 'success', icon: <CheckCircle /> },
  vencendo: { color: 'warning', icon: <WarningAmber /> },
  vencida: { color: 'error', icon: <ErrorOutline /> },
};

const CnhChip: React.FC<{ situacao: SituacaoCnh }> = ({ situacao }) => {
  const { color, icon } = CONFIG[situacao];
  return <Chip size="small" variant="outlined" color={color} icon={icon} label={SITUACAO_CNH_LABELS[situacao]} sx={{ fontWeight: 600 }} />;
};

export default CnhChip;
