import React from 'react';
import { Chip } from '@mui/material';
import { Block, Build, CheckCircle, DirectionsCar } from '@mui/icons-material';
import { Situacao, SITUACAO_LABELS } from '../../types';

/**
 * Identificação da situação do veículo por ícone + texto + cor,
 * para que a informação não dependa apenas da cor.
 */
const CONFIG: Record<Situacao, { color: 'success' | 'primary' | 'warning' | 'default'; icon: React.ReactElement }> = {
  disponivel: { color: 'success', icon: <CheckCircle /> },
  em_uso: { color: 'primary', icon: <DirectionsCar /> },
  manutencao: { color: 'warning', icon: <Build /> },
  indisponivel: { color: 'default', icon: <Block /> },
};

const SituacaoChip: React.FC<{ situacao: Situacao }> = ({ situacao }) => {
  const { color, icon } = CONFIG[situacao];
  return <Chip size="small" variant="outlined" color={color} icon={icon} label={SITUACAO_LABELS[situacao]} sx={{ fontWeight: 600 }} />;
};

export default SituacaoChip;
