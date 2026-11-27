import React from 'react';
import { Chip } from '@mui/material';
import { Block, VerifiedUser } from '@mui/icons-material';

/** Indica se o condutor foi liberado pelo Departamento de Frotas para usar veículos POOL. */
const PoolChip: React.FC<{ liberado: boolean }> = ({ liberado }) => (
  <Chip
    size="small"
    variant={liberado ? 'filled' : 'outlined'}
    color={liberado ? 'primary' : 'default'}
    icon={liberado ? <VerifiedUser /> : <Block />}
    label={liberado ? 'Liberado para o POOL' : 'Não liberado'}
    sx={{ fontWeight: 600 }}
  />
);

export default PoolChip;
