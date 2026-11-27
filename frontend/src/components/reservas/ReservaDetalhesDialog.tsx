import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid2 as Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Typography,
} from '@mui/material';
import { AddCircleOutline, Cancel, DirectionsCar, KeyboardReturn } from '@mui/icons-material';
import { reservaService } from '../../services/reservaService';
import { ApiError } from '../../services/apiService';
import { EventoReserva, TIPO_RESERVA_LABELS } from '../../types';
import { dataHora, numeroReserva } from '../../utils/datas';
import StatusReservaChip from './StatusReservaChip';

const EVENTOS: Record<EventoReserva['evento'], { texto: string; icone: React.ReactElement }> = {
  registro: { texto: 'Registro', icone: <AddCircleOutline color="primary" /> },
  retirada: { texto: 'Retirada do veículo', icone: <DirectionsCar color="primary" /> },
  cancelamento: { texto: 'Cancelamento', icone: <Cancel color="error" /> },
  devolucao: { texto: 'Devolução', icone: <KeyboardReturn color="success" /> },
};

const formatoKm = new Intl.NumberFormat('pt-BR');
const km = (valor: number) => `${formatoKm.format(valor)} km`;

const Campo: React.FC<{ rotulo: string; valor: React.ReactNode }> = ({ rotulo, valor }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{rotulo}</Typography>
    <Typography variant="body2" component="div">{valor}</Typography>
  </Box>
);

/** Detalhes da reserva ou empréstimo, com o registro de quem fez cada operação e quando. */
const ReservaDetalhesDialog: React.FC<{ id: string | null; onClose: () => void }> = ({ id, onClose }) => {
  const detalhe = useQuery({ queryKey: ['reserva', id], queryFn: () => reservaService.detalhe(id!), enabled: !!id });
  const r = detalhe.data;

  return (
    <Dialog open={!!id} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{r ? `${TIPO_RESERVA_LABELS[r.tipo]} nº ${numeroReserva(r.numero)}` : 'Detalhes'}</DialogTitle>
      <DialogContent dividers>
        {detalhe.isError && <Alert severity="error">{(detalhe.error as ApiError).message}</Alert>}
        {detalhe.isLoading && [1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
        {r && (
          <>
            <Grid container spacing={2} mb={2}>
              <Grid size={12}><StatusReservaChip status={r.status} atrasada={r.atrasada} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Campo rotulo="Veículo" valor={`${r.veiculo.placa} — ${r.veiculo.marca} ${r.veiculo.modelo} (${r.veiculo.codigo})`} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Campo rotulo="Condutor" valor={`${r.condutor.nome} (${r.condutor.matricula})`} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Campo rotulo="Início" valor={dataHora(r.inicio)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Campo rotulo="Previsão de devolução" valor={dataHora(r.fim_previsto)} /></Grid>
              {r.retirada_em && <Grid size={{ xs: 12, sm: 6 }}><Campo rotulo="Retirada registrada em" valor={dataHora(r.retirada_em)} /></Grid>}
              {r.devolvida_em && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Campo
                    rotulo="Devolução registrada em"
                    valor={<>{dataHora(r.devolvida_em)}{r.devolvida_com_atraso && <Typography component="span" variant="body2" color="error.main"> · com atraso</Typography>}</>}
                  />
                </Grid>
              )}
              {r.km_retirada !== null && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Campo
                    rotulo="Quilometragem"
                    valor={r.km_devolucao !== null
                      ? `${km(r.km_retirada)} → ${km(r.km_devolucao)} (${km(r.km_percorridos ?? 0)} percorridos)`
                      : `${km(r.km_retirada)} na retirada`}
                  />
                </Grid>
              )}
              {r.status === 'concluida' && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Campo rotulo="Situação do veículo após a devolução" valor={r.enviado_manutencao ? 'Enviado para manutenção' : 'Disponível'} />
                </Grid>
              )}
              {r.observacao_devolucao && <Grid size={12}><Campo rotulo="Observação da devolução" valor={r.observacao_devolucao} /></Grid>}
              <Grid size={12}><Campo rotulo="Finalidade" valor={r.finalidade} /></Grid>
              {r.observacoes && <Grid size={12}><Campo rotulo="Observações" valor={r.observacoes} /></Grid>}
              {r.motivo_cancelamento && <Grid size={12}><Campo rotulo="Motivo do cancelamento" valor={r.motivo_cancelamento} /></Grid>}
            </Grid>
            <Divider />
            <Typography variant="subtitle2" mt={2}>Histórico</Typography>
            <List dense aria-label="Histórico da reserva">
              {r.eventos.map((e, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>{EVENTOS[e.evento].icone}</ListItemIcon>
                  <ListItemText
                    primary={`${EVENTOS[e.evento].texto} — ${dataHora(e.criado_em)}`}
                    secondary={[e.usuario && `por ${e.usuario}`, e.observacao].filter(Boolean).join(' · ')}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReservaDetalhesDialog;
