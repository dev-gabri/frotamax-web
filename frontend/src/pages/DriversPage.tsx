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
import { Add, Badge, Edit, ErrorOutline, FilterAltOff, Search, VerifiedUser, WarningAmber } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { condutorService } from '../services/condutorService';
import { ApiError } from '../services/apiService';
import { Condutor, CondutorInput, FiltrosCondutores, SITUACAO_CNH_LABELS, SituacaoCnh } from '../types';
import { dataBR } from '../utils/datas';
import Indicador from '../components/Indicador';
import CnhChip from '../components/condutores/CnhChip';
import PoolChip from '../components/condutores/PoolChip';
import CondutorFormDialog from '../components/condutores/CondutorFormDialog';

const FILTROS_INICIAIS: FiltrosCondutores = { busca: '', situacao_cnh: '', liberado_pool: '', ativo: 'true' };

/**
 * Gestão de condutores (Sprint 02): indicadores, busca, filtros, listagem, cadastro, edição,
 * liberação para o POOL e inativação. Todas as operações passam pela API.
 */
const DriversPage: React.FC = () => {
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('md'));
  const { hasRole } = useAuth();
  const podeGerenciar = hasRole(['admin', 'gestor_frota']);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [filtros, setFiltros] = useState<FiltrosCondutores>(FILTROS_INICIAIS);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Condutor | null>(null);
  const [erroForm, setErroForm] = useState<ApiError | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, busca: buscaDigitada.trim() })), 350);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const lista = useQuery({ queryKey: ['condutores', filtros], queryFn: () => condutorService.listar(filtros) });
  const resumo = useQuery({ queryKey: ['condutores-resumo'], queryFn: condutorService.resumo });

  const salvar = useMutation({
    mutationFn: (dados: CondutorInput) => (editando ? condutorService.atualizar(editando.id, dados) : condutorService.criar(dados)),
    onSuccess: (c) => {
      enqueueSnackbar(editando ? `Condutor ${c.nome} atualizado.` : `Condutor ${c.nome} cadastrado.`, { variant: 'success' });
      setFormAberto(false);
      queryClient.invalidateQueries({ queryKey: ['condutores'] });
      queryClient.invalidateQueries({ queryKey: ['condutores-resumo'] });
    },
    onError: (error: ApiError) => setErroForm(error),
  });

  const abrirCadastro = () => { setEditando(null); setErroForm(null); setFormAberto(true); };
  const abrirEdicao = (c: Condutor) => { setEditando(c); setErroForm(null); setFormAberto(true); };

  const filtrosAtivos = useMemo(
    () => !!(filtros.busca || filtros.situacao_cnh || filtros.liberado_pool || filtros.ativo === 'false'),
    [filtros]
  );
  const limparFiltros = () => { setBuscaDigitada(''); setFiltros(FILTROS_INICIAIS); };

  const condutores = lista.data ?? [];
  const r = resumo.data;

  const acaoEditar = (c: Condutor) => podeGerenciar && (
    <Tooltip title="Editar condutor">
      <IconButton aria-label={`Editar condutor ${c.nome}`} onClick={(e) => { e.stopPropagation(); abrirEdicao(c); }}>
        <Edit />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h4" component="h1">Condutores</Typography>
          <Typography color="text.secondary">
            {podeGerenciar
              ? 'Cadastre os condutores, acompanhe a validade da CNH e controle a liberação para o POOL.'
              : 'Consulte os condutores, a validade da CNH e a liberação para o POOL.'}
          </Typography>
        </Box>
        {podeGerenciar && (
          <Button variant="contained" startIcon={<Add />} onClick={abrirCadastro} size="large">Novo condutor</Button>
        )}
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Condutores ativos" valor={r?.total} icone={<Badge />} cor={theme.palette.primary.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="Liberados para o POOL" valor={r?.liberados_pool} total={r?.total} rotuloTotal="dos condutores" icone={<VerifiedUser />} cor={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="CNH vence em até 30 dias" valor={r?.cnh_vencendo} icone={<WarningAmber />} cor={theme.palette.warning.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><Indicador titulo="CNH vencida" valor={r?.cnh_vencida} icone={<ErrorOutline />} cor={theme.palette.error.main} /></Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Buscar"
                placeholder="Nome ou matrícula"
                value={buscaDigitada}
                onChange={(e) => setBuscaDigitada(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
              <TextField select label="Situação da CNH" value={filtros.situacao_cnh} onChange={(e) => setFiltros((f) => ({ ...f, situacao_cnh: e.target.value as SituacaoCnh }))}>
                <MenuItem value="">Todas</MenuItem>
                {Object.entries(SITUACAO_CNH_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
              <TextField select label="Liberação POOL" value={filtros.liberado_pool} onChange={(e) => setFiltros((f) => ({ ...f, liberado_pool: e.target.value as FiltrosCondutores['liberado_pool'] }))}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="true">Liberados</MenuItem>
                <MenuItem value="false">Não liberados</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <TextField select label="Cadastro" value={filtros.ativo} onChange={(e) => setFiltros((f) => ({ ...f, ativo: e.target.value as 'true' | 'false' }))}>
                <MenuItem value="true">Ativos</MenuItem>
                <MenuItem value="false">Inativos</MenuItem>
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
      {lista.isSuccess && condutores.length === 0 && (
        <Alert severity="info">
          {filtrosAtivos ? 'Nenhum condutor encontrado com os filtros informados.' : 'Nenhum condutor cadastrado até o momento.'}
        </Alert>
      )}

      {lista.isSuccess && condutores.length > 0 && !telaPequena && (
        <Card>
          <Box px={2} py={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Lista de condutores</Typography>
            <Typography variant="caption" color="text.secondary">{condutores.length} condutor(es) exibido(s)</Typography>
          </Box>
          <Divider />
          <TableContainer>
            <Table aria-label="Lista de condutores">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Matrícula</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Validade da CNH</TableCell>
                  <TableCell>Liberação</TableCell>
                  <TableCell>Telefone</TableCell>
                  {podeGerenciar && <TableCell align="right">Ações</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {condutores.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.nome}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 15 }}>{c.matricula}</TableCell>
                    <TableCell>{c.cnh_categoria}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <span>{dataBR(c.cnh_validade)}</span>
                        <CnhChip situacao={c.situacao_cnh} />
                      </Stack>
                    </TableCell>
                    <TableCell><PoolChip liberado={c.liberado_pool} /></TableCell>
                    <TableCell>{c.telefone || '—'}</TableCell>
                    {podeGerenciar && <TableCell align="right">{acaoEditar(c)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {lista.isSuccess && condutores.length > 0 && telaPequena && (
        <Stack spacing={1.5} aria-label="Lista de condutores">
          <Typography variant="caption" color="text.secondary">{condutores.length} condutor(es) exibido(s)</Typography>
          {condutores.map((c) => (
            <Card key={c.id}>
              <CardActionArea component="div" onClick={() => podeGerenciar && abrirEdicao(c)} disabled={!podeGerenciar}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{c.nome}</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{c.matricula} · CNH {c.cnh_categoria}</Typography>
                      <Typography variant="caption" color="text.secondary">Validade {dataBR(c.cnh_validade)}{c.telefone ? ` · ${c.telefone}` : ''}</Typography>
                      <Stack direction="row" gap={0.5} mt={1} flexWrap="wrap">
                        <CnhChip situacao={c.situacao_cnh} />
                        <PoolChip liberado={c.liberado_pool} />
                      </Stack>
                    </Box>
                    {acaoEditar(c)}
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      <CondutorFormDialog
        open={formAberto}
        condutor={editando}
        salvando={salvar.isPending}
        erroApi={erroForm}
        onClose={() => setFormAberto(false)}
        onSubmit={(dados) => { setErroForm(null); salvar.mutate(dados); }}
      />
    </Box>
  );
};

export default DriversPage;
