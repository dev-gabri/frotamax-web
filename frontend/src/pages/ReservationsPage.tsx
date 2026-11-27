import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add,
  Cancel,
  DirectionsCar,
  EventAvailable,
  FilterAltOff,
  Info,
  Schedule,
  Search,
  WarningAmber,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { reservaService } from '../services/reservaService';
import { ApiError } from '../services/apiService';
import {
  FiltrosReservas,
  Reserva,
  ReservaInput,
  STATUS_RESERVA_LABELS,
  StatusReserva,
  TIPO_RESERVA_LABELS,
  TipoReserva,
} from '../types';
import { numeroReserva, periodo } from '../utils/datas';
import Indicador from '../components/Indicador';
import StatusReservaChip from '../components/reservas/StatusReservaChip';
import ReservaFormDialog from '../components/reservas/ReservaFormDialog';
import CancelarReservaDialog from '../components/reservas/CancelarReservaDialog';
import ReservaDetalhesDialog from '../components/reservas/ReservaDetalhesDialog';

const FILTROS_INICIAIS: FiltrosReservas = { busca: '', status: '', tipo: '' };

/**
 * Reservas e empréstimos de veículos POOL (Sprint 02): indicadores, busca, filtros, registro,
 * retirada, cancelamento e consulta do histórico. As regras são verificadas pela API.
 */
const ReservationsPage: React.FC = () => {
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('md'));
  const { hasRole } = useAuth();
  const podeGerenciar = hasRole(['admin', 'gestor_frota']);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [filtros, setFiltros] = useState<FiltrosReservas>(FILTROS_INICIAIS);
  const [formAberto, setFormAberto] = useState(false);
  const [erroForm, setErroForm] = useState<ApiError | null>(null);
  const [cancelando, setCancelando] = useState<Reserva | null>(null);
  const [erroCancelamento, setErroCancelamento] = useState<ApiError | null>(null);
  const [retirando, setRetirando] = useState<Reserva | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, busca: buscaDigitada.trim() })), 350);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const lista = useQuery({ queryKey: ['reservas', filtros], queryFn: () => reservaService.listar(filtros) });
  const resumo = useQuery({ queryKey: ['reservas-resumo'], queryFn: reservaService.resumo });

  /** Reservas alteram também a situação dos veículos e a disponibilidade. */
  const atualizarDados = () => {
    ['reservas', 'reservas-resumo', 'reserva', 'disponibilidade', 'veiculos', 'veiculos-resumo']
      .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const registrar = useMutation({
    mutationFn: (dados: ReservaInput) => reservaService.criar(dados),
    onSuccess: (r) => {
      enqueueSnackbar(
        r.tipo === 'emprestimo'
          ? `Empréstimo nº ${numeroReserva(r.numero)} registrado. ${r.veiculo.placa} está em uso.`
          : `Reserva nº ${numeroReserva(r.numero)} registrada para ${r.veiculo.placa}.`,
        { variant: 'success' }
      );
      setFormAberto(false);
      atualizarDados();
    },
    onError: (error: ApiError) => setErroForm(error),
  });

  const retirar = useMutation({
    mutationFn: (r: Reserva) => reservaService.registrarRetirada(r.id),
    onSuccess: (r) => {
      enqueueSnackbar(`Retirada registrada. ${r.veiculo.placa} está em uso com ${r.condutor.nome}.`, { variant: 'success' });
      setRetirando(null);
      atualizarDados();
    },
    onError: (error: ApiError) => { enqueueSnackbar(error.message, { variant: 'error' }); setRetirando(null); },
  });

  const cancelar = useMutation({
    mutationFn: ({ r, motivo }: { r: Reserva; motivo: string }) => reservaService.cancelar(r.id, motivo),
    onSuccess: (r) => {
      enqueueSnackbar(`Reserva nº ${numeroReserva(r.numero)} cancelada.`, { variant: 'success' });
      setCancelando(null);
      atualizarDados();
    },
    onError: (error: ApiError) => setErroCancelamento(error),
  });

  const filtrosAtivos = useMemo(() => !!(filtros.busca || filtros.status || filtros.tipo), [filtros]);
  const limparFiltros = () => { setBuscaDigitada(''); setFiltros(FILTROS_INICIAIS); };

  const reservas = lista.data ?? [];
  const r = resumo.data;

  const acoes = (res: Reserva) => (
    <Stack direction="row" justifyContent="flex-end" gap={0.5} flexWrap="wrap">
      <Tooltip title="Ver detalhes">
        <IconButton aria-label={`Detalhes da reserva ${numeroReserva(res.numero)}`} onClick={() => setDetalheId(res.id)}><Info /></IconButton>
      </Tooltip>
      {podeGerenciar && res.status === 'agendada' && (
        <>
          <Button size="small" variant="outlined" startIcon={<DirectionsCar />} onClick={() => setRetirando(res)}>Retirada</Button>
          <Tooltip title="Cancelar reserva">
            <IconButton color="error" aria-label={`Cancelar reserva ${numeroReserva(res.numero)}`} onClick={() => { setErroCancelamento(null); setCancelando(res); }}>
              <Cancel />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Stack>
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h4" component="h1">Reservas e empréstimos</Typography>
          <Typography color="text.secondary">
            {podeGerenciar
              ? 'Registre reservas e empréstimos de veículos POOL e acompanhe a utilização da frota.'
              : 'Acompanhe as reservas e os empréstimos de veículos POOL.'}
          </Typography>
        </Box>
        {podeGerenciar && (
          <Button variant="contained" startIcon={<Add />} onClick={() => { setErroForm(null); setFormAberto(true); }} size="large">
            Nova reserva ou empréstimo
          </Button>
        )}
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Reservas agendadas" valor={r?.agendadas} icone={<Schedule />} cor={theme.palette.info.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Veículos em uso" valor={r?.em_uso} icone={<DirectionsCar />} cor={theme.palette.primary.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Retiradas previstas hoje" valor={r?.retiradas_hoje} icone={<EventAvailable />} cor={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Devoluções atrasadas" valor={r?.atrasadas} icone={<WarningAmber />} cor={theme.palette.error.main} /></Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                label="Buscar"
                placeholder="Nº, placa, veículo, condutor, matrícula ou finalidade"
                value={buscaDigitada}
                onChange={(e) => setBuscaDigitada(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField select label="Status" value={filtros.status} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value as StatusReserva }))}>
                <MenuItem value="">Todos</MenuItem>
                {Object.entries(STATUS_RESERVA_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField select label="Tipo" value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value as TipoReserva }))}>
                <MenuItem value="">Todos</MenuItem>
                {Object.entries(TIPO_RESERVA_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 1 }} sx={{ textAlign: { md: 'right' } }}>
              {telaPequena ? (
                <Button fullWidth variant="outlined" startIcon={<FilterAltOff />} onClick={limparFiltros} disabled={!filtrosAtivos}>Limpar filtros</Button>
              ) : (
                <Tooltip title="Limpar filtros">
                  <span><IconButton aria-label="Limpar filtros" onClick={limparFiltros} disabled={!filtrosAtivos}><FilterAltOff /></IconButton></span>
                </Tooltip>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {lista.isError && (
        <Alert severity="error" action={<Button color="inherit" onClick={() => lista.refetch()}>Tentar novamente</Button>}>
          {(lista.error as ApiError).message}
        </Alert>
      )}
      {lista.isLoading && <Card><CardContent>{[1, 2, 3, 4].map((i) => <Skeleton key={i} height={48} />)}</CardContent></Card>}
      {lista.isSuccess && reservas.length === 0 && (
        <Alert severity="info">
          {filtrosAtivos ? 'Nenhuma reserva encontrada com os filtros informados.' : 'Nenhuma reserva ou empréstimo registrado até o momento.'}
        </Alert>
      )}

      {lista.isSuccess && reservas.length > 0 && !telaPequena && (
        <Card>
          <Box px={2} py={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Reservas e empréstimos</Typography>
            <Typography variant="caption" color="text.secondary">{reservas.length} registro(s) exibido(s) · em uso e agendadas primeiro</Typography>
          </Box>
          <Divider />
          <TableContainer>
            <Table aria-label="Lista de reservas e empréstimos">
              <TableHead>
                <TableRow>
                  <TableCell>Nº</TableCell>
                  <TableCell>Veículo</TableCell>
                  <TableCell>Condutor</TableCell>
                  <TableCell>Período</TableCell>
                  <TableCell>Finalidade</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reservas.map((res) => (
                  <TableRow key={res.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{numeroReserva(res.numero)}</Typography>
                      <Typography variant="caption" color="text.secondary">{TIPO_RESERVA_LABELS[res.tipo]}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{res.veiculo.placa}</Typography>
                      <Typography variant="caption" color="text.secondary">{res.veiculo.marca} {res.veiculo.modelo}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{res.condutor.nome}</Typography>
                      <Typography variant="caption" color="text.secondary">{res.condutor.matricula}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{periodo(res.inicio, res.fim_previsto)}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>{res.finalidade}</TableCell>
                    <TableCell><StatusReservaChip status={res.status} atrasada={res.atrasada} /></TableCell>
                    <TableCell align="right">{acoes(res)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {lista.isSuccess && reservas.length > 0 && telaPequena && (
        <Stack spacing={1.5} aria-label="Lista de reservas e empréstimos">
          <Typography variant="caption" color="text.secondary">{reservas.length} registro(s) exibido(s)</Typography>
          {reservas.map((res) => (
            <Card key={res.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 17 }}>{res.veiculo.placa}</Typography>
                    <Typography variant="body2">{res.veiculo.marca} {res.veiculo.modelo}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {TIPO_RESERVA_LABELS[res.tipo]} nº {numeroReserva(res.numero)}
                  </Typography>
                </Stack>
                <Typography variant="body2">{res.condutor.nome} · {res.condutor.matricula}</Typography>
                <Typography variant="body2" color="text.secondary">{periodo(res.inicio, res.fim_previsto)}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>{res.finalidade}</Typography>
                <StatusReservaChip status={res.status} atrasada={res.atrasada} />
                <Box mt={1}>{acoes(res)}</Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <ReservaFormDialog
        open={formAberto}
        salvando={registrar.isPending}
        erroApi={erroForm}
        onClose={() => setFormAberto(false)}
        onSubmit={(dados) => { setErroForm(null); registrar.mutate(dados); }}
      />

      <CancelarReservaDialog
        reserva={cancelando}
        salvando={cancelar.isPending}
        erroApi={erroCancelamento}
        onClose={() => setCancelando(null)}
        onConfirm={(motivo) => cancelando && cancelar.mutate({ r: cancelando, motivo })}
      />

      {/* Confirmação da retirada */}
      <Dialog open={!!retirando} onClose={retirar.isPending ? undefined : () => setRetirando(null)} fullWidth maxWidth="xs">
        <DialogTitle>Registrar retirada</DialogTitle>
        <DialogContent dividers>
          {retirando && (
            <Typography variant="body2">
              Confirmar a retirada de <strong>{retirando.veiculo.placa}</strong> ({retirando.veiculo.modelo}) por{' '}
              <strong>{retirando.condutor.nome}</strong>? O veículo passará para a situação “Em uso” até o registro da devolução.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRetirando(null)} disabled={retirar.isPending}>Voltar</Button>
          <Button
            variant="contained"
            onClick={() => retirando && retirar.mutate(retirando)}
            disabled={retirar.isPending}
            startIcon={retirar.isPending ? <CircularProgress size={16} color="inherit" /> : <DirectionsCar />}
          >
            Confirmar retirada
          </Button>
        </DialogActions>
      </Dialog>

      <ReservaDetalhesDialog id={detalheId} onClose={() => setDetalheId(null)} />
    </Box>
  );
};

export default ReservationsPage;
