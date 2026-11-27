import React, { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Info } from '@mui/icons-material';
import { reservaService } from '../../services/reservaService';
import { ApiError } from '../../services/apiService';
import { Reserva, TIPO_RESERVA_LABELS } from '../../types';
import { dataHora, numeroReserva, periodo } from '../../utils/datas';
import StatusReservaChip from './StatusReservaChip';
import ReservaDetalhesDialog from './ReservaDetalhesDialog';

export interface AlvoHistorico {
  tipo: 'veiculo' | 'condutor';
  id: string;
  /** Ex.: "ABC1D23 — Toyota Corolla" ou "Ana Paula Ribeiro (M-1001)" */
  titulo: string;
}

const formatoKm = new Intl.NumberFormat('pt-BR');
const POR_PAGINA = 10;

const Numero: React.FC<{ rotulo: string; valor: React.ReactNode }> = ({ rotulo, valor }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Typography variant="caption" color="text.secondary">{rotulo}</Typography>
      <Typography variant="h6" component="p">{valor}</Typography>
    </CardContent>
  </Card>
);

/** Utilização efetiva: retirada e devolução, ou o motivo de não ter havido utilização. */
function utilizacao(r: Reserva) {
  if (r.status === 'cancelada') return 'Cancelada antes da retirada';
  if (r.status === 'agendada') return 'Aguardando retirada';
  if (!r.retirada_em) return '—';
  return r.devolvida_em ? periodo(r.retirada_em, r.devolvida_em) : `Retirado em ${dataHora(r.retirada_em)} · em uso`;
}

/**
 * Histórico de utilização de um veículo ou de um condutor (Sprint 03, RF12/CA08):
 * resumo e movimentações, inclusive as encerradas, das mais recentes para as mais antigas.
 */
const HistoricoDialog: React.FC<{ alvo: AlvoHistorico | null; onClose: () => void }> = ({ alvo, onClose }) => {
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('md'));
  const [pagina, setPagina] = useState(0);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  useEffect(() => { setPagina(0); }, [alvo?.id]);

  const historico = useQuery({
    queryKey: ['historico', alvo?.tipo, alvo?.id, pagina],
    queryFn: () => (alvo!.tipo === 'veiculo'
      ? reservaService.historicoVeiculo(alvo!.id, pagina + 1, POR_PAGINA)
      : reservaService.historicoCondutor(alvo!.id, pagina + 1, POR_PAGINA)),
    enabled: !!alvo,
    placeholderData: keepPreviousData,
  });
  const h = historico.data;
  const deVeiculo = alvo?.tipo === 'veiculo';

  return (
    <Dialog open={!!alvo} onClose={onClose} fullWidth maxWidth="lg" fullScreen={telaPequena}>
      <DialogTitle>
        Histórico de utilização
        <Typography variant="body2" color="text.secondary">{alvo?.titulo}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {historico.isError && (
          <Alert severity="error" action={<Button color="inherit" onClick={() => historico.refetch()}>Tentar novamente</Button>}>
            {(historico.error as ApiError).message}
          </Alert>
        )}
        {historico.isLoading && [1, 2, 3, 4].map((i) => <Skeleton key={i} height={44} />)}
        {h && (
          <>
            {(h.veiculo?.ativo === false || h.condutor?.ativo === false) && (
              <Alert severity="info" sx={{ mb: 2 }}>Cadastro inativo. O histórico continua disponível para consulta.</Alert>
            )}
            <Grid container spacing={1.5} mb={2}>
              <Grid size={{ xs: 6, md: 3 }}><Numero rotulo="Movimentações" valor={h.resumo.movimentacoes} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Numero rotulo="Devoluções registradas" valor={h.resumo.concluidas} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Numero rotulo="Quilômetros percorridos" valor={`${formatoKm.format(h.resumo.km_percorridos)} km`} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Numero rotulo="Devoluções com atraso" valor={h.resumo.devolvidas_com_atraso} />
              </Grid>
            </Grid>
            {h.veiculo && (
              <Typography variant="body2" color="text.secondary" mb={1}>
                Quilometragem atual: {formatoKm.format(h.veiculo.quilometragem)} km
                {h.resumo.ultima_devolucao && ` · última devolução em ${dataHora(h.resumo.ultima_devolucao)}`}
              </Typography>
            )}

            {h.itens.length === 0 && (
              <Alert severity="info">
                {deVeiculo ? 'Nenhuma reserva ou empréstimo registrado para este veículo.' : 'Nenhuma reserva ou empréstimo registrado para este condutor.'}
              </Alert>
            )}

            {h.itens.length > 0 && !telaPequena && (
              <TableContainer>
                <Table size="small" aria-label="Movimentações do histórico">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nº</TableCell>
                      <TableCell>{deVeiculo ? 'Condutor' : 'Veículo'}</TableCell>
                      <TableCell>Período previsto</TableCell>
                      <TableCell>Utilização (retirada – devolução)</TableCell>
                      <TableCell align="right">Km percorridos</TableCell>
                      <TableCell>Situação</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {h.itens.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{numeroReserva(r.numero)}</Typography>
                          <Typography variant="caption" color="text.secondary">{TIPO_RESERVA_LABELS[r.tipo]}</Typography>
                        </TableCell>
                        <TableCell>
                          {deVeiculo
                            ? <><Typography variant="body2">{r.condutor.nome}</Typography><Typography variant="caption" color="text.secondary">{r.condutor.matricula}</Typography></>
                            : <><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.veiculo.placa}</Typography><Typography variant="caption" color="text.secondary">{r.veiculo.marca} {r.veiculo.modelo}</Typography></>}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{periodo(r.inicio, r.fim_previsto)}</TableCell>
                        <TableCell>
                          {utilizacao(r)}
                          {r.devolvida_com_atraso && <Typography variant="caption" color="error.main" display="block">Devolvido com atraso</Typography>}
                          {r.enviado_manutencao && <Typography variant="caption" color="warning.dark" display="block">Enviado para manutenção</Typography>}
                        </TableCell>
                        <TableCell align="right">{r.km_percorridos !== null ? `${formatoKm.format(r.km_percorridos)} km` : '—'}</TableCell>
                        <TableCell><StatusReservaChip status={r.status} atrasada={r.atrasada} /></TableCell>
                        <TableCell align="right">
                          <Tooltip title="Ver detalhes">
                            <IconButton aria-label={`Detalhes da movimentação ${numeroReserva(r.numero)}`} onClick={() => setDetalheId(r.id)}><Info /></IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {h.itens.length > 0 && telaPequena && (
              <Stack spacing={1.25} aria-label="Movimentações do histórico">
                {h.itens.map((r) => (
                  <Card key={r.id} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {TIPO_RESERVA_LABELS[r.tipo]} nº {numeroReserva(r.numero)}
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {deVeiculo ? r.condutor.nome : `${r.veiculo.placa} · ${r.veiculo.modelo}`}
                          </Typography>
                        </Box>
                        <IconButton size="small" aria-label={`Detalhes da movimentação ${numeroReserva(r.numero)}`} onClick={() => setDetalheId(r.id)}><Info /></IconButton>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{utilizacao(r)}</Typography>
                      <Stack direction="row" gap={1} alignItems="center" mt={0.5} flexWrap="wrap">
                        <StatusReservaChip status={r.status} atrasada={r.atrasada} />
                        {r.km_percorridos !== null && <Typography variant="caption">{formatoKm.format(r.km_percorridos)} km</Typography>}
                        {r.devolvida_com_atraso && <Typography variant="caption" color="error.main">com atraso</Typography>}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}

            {h.meta.total > POR_PAGINA && (
              <TablePagination
                component="div" count={h.meta.total} page={pagina} onPageChange={(_e, p) => setPagina(p)}
                rowsPerPage={POR_PAGINA} rowsPerPageOptions={[POR_PAGINA]}
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
      <ReservaDetalhesDialog id={detalheId} onClose={() => setDetalheId(null)} />
    </Dialog>
  );
};

export default HistoricoDialog;
