import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Divider,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
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
  Block,
  Build,
  CheckCircle,
  DirectionsCar,
  Edit,
  FilterAltOff,
  MoreVert,
  Search,
  SwapHoriz,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { veiculoService } from '../services/veiculoService';
import { ApiError } from '../services/apiService';
import {
  FiltrosVeiculos,
  MODALIDADE_LABELS,
  SITUACAO_LABELS,
  Situacao,
  TIPO_LABELS,
  Veiculo,
  VeiculoInput,
} from '../types';
import SituacaoChip from '../components/veiculos/SituacaoChip';
import VeiculoFormDialog from '../components/veiculos/VeiculoFormDialog';
import Indicador from '../components/Indicador';

const km = (n: number) => `${n.toLocaleString('pt-BR')}\u00A0km`;

/**
 * Gestão de veículos (card S1-05): indicadores, busca, filtros, listagem,
 * cadastro, edição e alteração da situação. Todas as operações passam pela API.
 */
const VehiclesPage: React.FC = () => {
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('md'));
  const { hasRole } = useAuth();
  const podeGerenciar = hasRole(['admin', 'gestor_frota']);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [filtros, setFiltros] = useState<FiltrosVeiculos>({ busca: '', situacao: '', tipo: '', modalidade: '' });
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [erroForm, setErroForm] = useState<ApiError | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; veiculo: Veiculo } | null>(null);

  // Aguarda o usuário parar de digitar antes de consultar a API
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, busca: buscaDigitada.trim() })), 350);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const lista = useQuery({ queryKey: ['veiculos', filtros], queryFn: () => veiculoService.listar(filtros) });
  const resumo = useQuery({ queryKey: ['veiculos-resumo'], queryFn: veiculoService.resumo });

  const atualizarDados = () => {
    queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    queryClient.invalidateQueries({ queryKey: ['veiculos-resumo'] });
  };

  const salvar = useMutation({
    mutationFn: (dados: VeiculoInput) => (editando ? veiculoService.atualizar(editando.id, dados) : veiculoService.criar(dados)),
    onSuccess: (v) => {
      enqueueSnackbar(editando ? `Veículo ${v.placa} atualizado.` : `Veículo ${v.placa} cadastrado.`, { variant: 'success' });
      setFormAberto(false);
      atualizarDados();
    },
    onError: (error: ApiError) => setErroForm(error),
  });

  const mudarSituacao = useMutation({
    mutationFn: ({ id, situacao }: { id: string; situacao: Situacao }) => veiculoService.alterarSituacao(id, situacao),
    onSuccess: (v) => {
      enqueueSnackbar(`Situação de ${v.placa} alterada para "${SITUACAO_LABELS[v.situacao]}".`, { variant: 'success' });
      atualizarDados();
    },
    onError: (error: ApiError) => enqueueSnackbar(error.message, { variant: 'error' }),
  });

  const abrirCadastro = () => { setEditando(null); setErroForm(null); setFormAberto(true); };
  const abrirEdicao = (v: Veiculo) => { setEditando(v); setErroForm(null); setFormAberto(true); };

  const filtrosAtivos = useMemo(
    () => !!(filtros.busca || filtros.situacao || filtros.tipo || filtros.modalidade),
    [filtros]
  );
  const limparFiltros = () => { setBuscaDigitada(''); setFiltros({ busca: '', situacao: '', tipo: '', modalidade: '' }); };

  const veiculos = lista.data ?? [];
  const r = resumo.data;

  const acoes = (v: Veiculo) => podeGerenciar && (
    <Tooltip title="Mais ações">
      <IconButton aria-label={`Ações do veículo ${v.placa}`} onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, veiculo: v }); }}>
        <MoreVert />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box>
      {/* Cabeçalho */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h4" component="h1">Veículos</Typography>
          <Typography color="text.secondary">
            {podeGerenciar ? 'Cadastre, consulte e atualize os veículos da frota.' : 'Consulte os veículos da frota e sua situação atual.'}
          </Typography>
        </Box>
        {podeGerenciar && (
          <Button variant="contained" startIcon={<Add />} onClick={abrirCadastro} size="large">Novo veículo</Button>
        )}
      </Stack>

      {/* Indicadores */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Total de veículos" valor={r?.total} icone={<DirectionsCar />} cor={theme.palette.primary.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Disponíveis" valor={r?.disponivel} total={r?.total} icone={<CheckCircle />} cor={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Em uso" valor={r?.em_uso} total={r?.total} icone={<DirectionsCar />} cor={theme.palette.info.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Em manutenção" valor={r?.manutencao} total={r?.total} icone={<Build />} cor={theme.palette.warning.main} /></Grid>
      </Grid>

      {/* Busca e filtros */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Buscar"
                placeholder="Placa, código, marca, modelo ou unidade"
                value={buscaDigitada}
                onChange={(e) => setBuscaDigitada(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
              <TextField select label="Situação" value={filtros.situacao} onChange={(e) => setFiltros((f) => ({ ...f, situacao: e.target.value as Situacao }))}>
                <MenuItem value="">Todas</MenuItem>
                {Object.entries(SITUACAO_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
              <TextField select label="Tipo" value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value as FiltrosVeiculos['tipo'] }))}>
                <MenuItem value="">Todos</MenuItem>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <TextField select label="Modalidade" value={filtros.modalidade} onChange={(e) => setFiltros((f) => ({ ...f, modalidade: e.target.value as FiltrosVeiculos['modalidade'] }))}>
                <MenuItem value="">Todas</MenuItem>
                {Object.entries(MODALIDADE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 1 }} sx={{ textAlign: { md: 'right' } }}>
              {telaPequena ? (
                <Button fullWidth variant="outlined" startIcon={<FilterAltOff />} onClick={limparFiltros} disabled={!filtrosAtivos}>
                  Limpar filtros
                </Button>
              ) : (
                <Tooltip title="Limpar filtros">
                  <span>
                    <IconButton aria-label="Limpar filtros" onClick={limparFiltros} disabled={!filtrosAtivos}><FilterAltOff /></IconButton>
                  </span>
                </Tooltip>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Lista */}
      {lista.isError && (
        <Alert severity="error" action={<Button color="inherit" onClick={() => lista.refetch()}>Tentar novamente</Button>}>
          {(lista.error as ApiError).message}
        </Alert>
      )}

      {lista.isLoading && <Card><CardContent>{[1, 2, 3, 4].map((i) => <Skeleton key={i} height={48} />)}</CardContent></Card>}

      {lista.isSuccess && veiculos.length === 0 && (
        <Alert severity="info">
          {filtrosAtivos ? 'Nenhum veículo encontrado com os filtros informados.' : 'Nenhum veículo cadastrado até o momento.'}
        </Alert>
      )}

      {lista.isSuccess && veiculos.length > 0 && !telaPequena && (
        <Card>
          <Box px={2} py={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Lista de veículos</Typography>
            <Typography variant="caption" color="text.secondary">{veiculos.length} veículo(s) exibido(s)</Typography>
          </Box>
          <Divider />
          <TableContainer>
            <Table size="medium" aria-label="Lista de veículos">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Placa</TableCell>
                  <TableCell>Veículo</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Unidade</TableCell>
                  <TableCell align="right">Quilometragem</TableCell>
                  <TableCell>Modalidade</TableCell>
                  <TableCell>Situação</TableCell>
                  {podeGerenciar && <TableCell align="right">Ações</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {veiculos.map((v) => (
                  <TableRow key={v.id} hover>
                    <TableCell>{v.codigo}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 15 }}>{v.placa}</TableCell>
                    <TableCell>{v.marca} {v.modelo}{v.ano_modelo ? ` · ${v.ano_modelo}` : ''}</TableCell>
                    <TableCell>{TIPO_LABELS[v.tipo]}</TableCell>
                    <TableCell>{v.unidade}</TableCell>
                    <TableCell align="right">{km(v.quilometragem)}</TableCell>
                    <TableCell>{v.modalidade === 'pool' ? 'Pool' : 'Atribuído'}</TableCell>
                    <TableCell><SituacaoChip situacao={v.situacao} /></TableCell>
                    {podeGerenciar && <TableCell align="right">{acoes(v)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Em telas menores a tabela é substituída por cartões empilhados */}
      {lista.isSuccess && veiculos.length > 0 && telaPequena && (
        <Stack spacing={1.5} aria-label="Lista de veículos">
          <Typography variant="caption" color="text.secondary">{veiculos.length} veículo(s) exibido(s)</Typography>
          {veiculos.map((v) => (
            <Card key={v.id}>
              <CardActionArea component="div" onClick={() => podeGerenciar && abrirEdicao(v)} disabled={!podeGerenciar}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 17 }}>{v.placa}</Typography>
                      <Typography variant="body2">{v.marca} {v.modelo} · {TIPO_LABELS[v.tipo]}</Typography>
                      <Typography variant="caption" color="text.secondary">{v.codigo} · {v.unidade} · {km(v.quilometragem)}</Typography>
                    </Box>
                    <Stack alignItems="flex-end" gap={0.5}>
                      <SituacaoChip situacao={v.situacao} />
                      {acoes(v)}
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      {/* Menu de ações do veículo */}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { if (menu) abrirEdicao(menu.veiculo); setMenu(null); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>Editar informações
        </MenuItem>
        <Divider />
        <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
          <SwapHoriz fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />Alterar situação para
        </Typography>
        {(Object.keys(SITUACAO_LABELS) as Situacao[]).filter((s) => s !== menu?.veiculo.situacao).map((s) => (
          <MenuItem
            key={s}
            onClick={() => { if (menu) mudarSituacao.mutate({ id: menu.veiculo.id, situacao: s }); setMenu(null); }}
          >
            <ListItemIcon>
              {s === 'disponivel' ? <CheckCircle fontSize="small" /> : s === 'em_uso' ? <DirectionsCar fontSize="small" /> : s === 'manutencao' ? <Build fontSize="small" /> : <Block fontSize="small" />}
            </ListItemIcon>
            {SITUACAO_LABELS[s]}
          </MenuItem>
        ))}
      </Menu>

      <VeiculoFormDialog
        open={formAberto}
        veiculo={editando}
        salvando={salvar.isPending}
        erroApi={erroForm}
        onClose={() => setFormAberto(false)}
        onSubmit={(dados) => { setErroForm(null); salvar.mutate(dados); }}
      />
    </Box>
  );
};

export default VehiclesPage;
