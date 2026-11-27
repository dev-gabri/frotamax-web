import React from 'react';
import { Box, Card, CardActionArea, CardContent, Skeleton, Typography } from '@mui/material';

interface Props {
  titulo: string;
  valor?: number;
  /** Quando informado, mostra o percentual em relação ao total. */
  total?: number;
  rotuloTotal?: string;
  icone: React.ReactNode;
  cor: string;
  /** Regra de cálculo do número, exibida abaixo dele (tela inicial, Sprint 04). */
  descricao?: string;
  /** Quando informado, o cartão vira um atalho para a lista correspondente. */
  aoClicar?: () => void;
}

/** Cartão de indicador usado no topo das telas (totais e quantidades por situação). */
const Indicador: React.FC<Props> = ({ titulo, valor, total, rotuloTotal = 'da frota', icone, cor, descricao, aoClicar }) => {
  const conteudo = (
    <CardContent sx={{ display: 'flex', alignItems: descricao ? 'flex-start' : 'center', gap: 2 }}>
      <Box sx={{ bgcolor: `${cor}1A`, color: cor, borderRadius: 2, p: 1.2, display: 'flex' }} aria-hidden>{icone}</Box>
      <Box minWidth={0}>
        <Typography variant="body2" color="text.secondary">{titulo}</Typography>
        {valor === undefined ? <Skeleton width={40} height={36} /> : (
          <Typography variant="h5" component="p">{valor}</Typography>
        )}
        {total !== undefined && valor !== undefined && total > 0 && (
          <Typography variant="caption" color="text.secondary" display="block">{Math.round((valor / total) * 100)}% {rotuloTotal}</Typography>
        )}
        {descricao && <Typography variant="caption" color="text.secondary" display="block">{descricao}</Typography>}
      </Box>
    </CardContent>
  );

  return (
    <Card sx={{ height: '100%' }}>
      {aoClicar ? (
        <CardActionArea
          onClick={aoClicar}
          sx={{ height: '100%' }}
          aria-label={`${titulo}: ${valor ?? 'carregando'}. Abrir a lista`}
        >
          {conteudo}
        </CardActionArea>
      ) : conteudo}
    </Card>
  );
};

export default Indicador;
