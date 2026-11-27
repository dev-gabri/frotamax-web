import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid2 as Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowForward,
  Badge,
  Block,
  Build,
  CheckCircle,
  DirectionsCar,
  EventAvailable,
  EventBusy,
  Refresh,
  Schedule,
  Update,
  VerifiedUser,
  WarningAmber,
} from '@mui/icons-material';
import { veiculoService } from '../services/veiculoService';
import { condutorService } from '../services/condutorService';
import { reservaService } from '../services/reservaService';
import { ApiError } from '../services/apiService';
import { PRAZO_LABELS, PrazoReserva, Reserva } from '../types';
import { dataHora, numeroReserva } from '../utils/datas';
import Indicador from '../components/Indicador';

const ITENS_NA_LISTA = 5;

const horaAtual = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const Secao: React.FC<{ titulo: string; destino: string; rotulo: string; children: React.ReactNode }> = ({ titulo, destino, rotulo, children }) => {
  const navigate = useNavigate();
  return (
    <Box component="section" mb={3} aria-label={titulo}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="h6" component="h2">{titulo}</Typography>
        <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate(destino)}>{rotulo}</Button>
      </Stack>
      {children}
    </Box>
  );
};

const ErroSecao: React.FC<{ erro: unknown; tentar: () => void }> = ({ erro, tentar }) => (
  <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={tentar}>Tentar novamente</Button>}>
    {(erro as ApiError).message}
  </Alert>
);

/** Lista curta das movimentações que pedem atenção hoje, com atalho para a lista completa. */
const ListaPrazo: React.FC<{ prazo: PrazoReserva; vazio: string; detalhe: (r: Reserva) => string }> = ({ prazo, vazio, detalhe }) => {
  const navigate = useNavigate();
  const consulta = useQuery({
    queryKey: ['reservas', { prazo, por_pagina: ITENS_NA_LISTA }],
    queryFn: () => reservaService.listar({ prazo, pagina: 1, por_pagina: ITENS_NA_LISTA }),
  });
  const itens = consulta.data?.itens ?? [];
  const total = consulta.data?.meta.total ?? 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={PRAZO_LABELS[prazo]}
        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600, component: 'h3' }}
        subheader={consulta.isSuccess ? `${total} movimentação(ões)` : undefined}
        action={total > 0 && (
          <Button size="small" onClick={() => navigate(`/reservas?prazo=${prazo}`)}>
            {total > ITENS_NA_LISTA ? `Ver todas (${total})` : 'Abrir na lista'}
          </Button>
        )}
      />
      <Divider />
      {consulta.isLoading && <CardContent>{[1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}</CardContent>}
      {consulta.isError && <CardContent><ErroSecao erro={consulta.error} tentar={() => consulta.refetch()} /></CardContent>}
      {consulta.isSuccess && itens.length === 0 && (
        <CardContent><Typography color="text.secondary">{vazio}</Typography></CardContent>
      )}
      {consulta.isSuccess && itens.length > 0 && (
        <List dense aria-label={PRAZO_LABELS[prazo]}>
          {itens.map((r) => (
            <ListItem key={r.id} divider>
              <ListItemText
                primary={`Nº ${numeroReserva(r.numero)} · ${r.veiculo.placa} (${r.veiculo.modelo})`}
                secondary={detalhe(r)}
                primaryTypographyProps={{ fontWeight: 600 }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Card>
  );
};

/**
 * Tela inicial (Sprint 04, RF14/CA10): reúne em um só lugar os números da frota que o
 * Departamento de Frotas acompanha no dia a dia. Todos os números vêm da API, com a mesma
 * regra das telas de origem, e cada cartão abre a lista correspondente já filtrada.
 */
const InicioPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const veiculos = useQuery({ queryKey: ['veiculos-resumo'], queryFn: veiculoService.resumo });
  const reservas = useQuery({ queryKey: ['reservas-resumo'], queryFn: reservaService.resumo });
  const condutores = useQuery({ queryKey: ['condutores-resumo'], queryFn: condutorService.resumo });

  const v = veiculos.data;
  const r = reservas.data;
  const c = condutores.data;
  const atualizadoEm = Math.max(veiculos.dataUpdatedAt, reservas.dataUpdatedAt, condutores.dataUpdatedAt);
  const atualizar = () => { veiculos.refetch(); reservas.refetch(); condutores.refetch(); };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} mb={3}>
        <Box>
          <Typography variant="h4" component="h1">Início</Typography>
          <Typography color="text.secondary">Resumo da frota a partir dos cadastros e das movimentações registrados no Frota Max.</Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {atualizadoEm > 0 && (
            <Typography variant="caption" color="text.secondary">Atualizado às {horaAtual(new Date(atualizadoEm))}</Typography>
          )}
          <Tooltip title="Atualizar os números">
            <IconButton aria-label="Atualizar os números" onClick={atualizar}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Secao titulo="Veículos" destino="/veiculos" rotulo="Abrir veículos">
        {veiculos.isError && <ErroSecao erro={veiculos.error} tentar={() => veiculos.refetch()} />}
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
            <Indicador titulo="Total de veículos" valor={v?.total} icone={<DirectionsCar />} cor={theme.palette.primary.main}
              descricao="Cadastros ativos" aoClicar={() => navigate('/veiculos')} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
            <Indicador titulo="Disponíveis" valor={v?.disponivel} total={v?.total} icone={<CheckCircle />} cor={theme.palette.success.main}
              aoClicar={() => navigate('/veiculos?situacao=disponivel')} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
            <Indicador titulo="Em uso" valor={v?.em_uso} total={v?.total} icone={<DirectionsCar />} cor={theme.palette.info.main}
              aoClicar={() => navigate('/veiculos?situacao=em_uso')} />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, lg: 2.4 }}>
            <Indicador titulo="Em manutenção" valor={v?.manutencao} total={v?.total} icone={<Build />} cor={theme.palette.warning.main}
              aoClicar={() => navigate('/veiculos?situacao=manutencao')} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
            <Indicador titulo="Indisponíveis" valor={v?.indisponivel} total={v?.total} icone={<Block />} cor={theme.palette.grey[600]}
              aoClicar={() => navigate('/veiculos?situacao=indisponivel')} />
          </Grid>
        </Grid>
      </Secao>

      <Secao titulo="Reservas e empréstimos" destino="/reservas" rotulo="Abrir movimentações">
        {reservas.isError && <ErroSecao erro={reservas.error} tentar={() => reservas.refetch()} />}
        <Grid container spacing={2} mb={2}>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="Retiradas previstas hoje" valor={r?.retiradas_hoje} icone={<EventAvailable />} cor={theme.palette.success.main}
              descricao="Reservas agendadas com início hoje" aoClicar={() => navigate('/reservas?prazo=retiradas_hoje')} />
          </Grid>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="Devoluções atrasadas" valor={r?.atrasadas} icone={<WarningAmber />} cor={theme.palette.error.main}
              descricao="Empréstimos com a previsão de devolução vencida" aoClicar={() => navigate('/reservas?prazo=atrasadas')} />
          </Grid>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="Empréstimos em andamento" valor={r?.em_uso} icone={<DirectionsCar />} cor={theme.palette.primary.main}
              descricao="Veículos retirados e ainda não devolvidos" aoClicar={() => navigate('/reservas?status=em_uso')} />
          </Grid>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="Reservas agendadas" valor={r?.agendadas} icone={<Schedule />} cor={theme.palette.info.main}
              descricao="Registradas e ainda não retiradas" aoClicar={() => navigate('/reservas?status=agendada')} />
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListaPrazo
              prazo="atrasadas" vazio="Nenhuma devolução atrasada."
              detalhe={(m) => `${m.condutor.nome} · devolução prevista para ${dataHora(m.fim_previsto)}`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListaPrazo
              prazo="retiradas_hoje" vazio="Nenhuma retirada prevista para hoje."
              detalhe={(m) => `${m.condutor.nome} · retirada prevista para ${dataHora(m.inicio)}`}
            />
          </Grid>
        </Grid>
      </Secao>

      <Secao titulo="Condutores" destino="/condutores" rotulo="Abrir condutores">
        {condutores.isError && <ErroSecao erro={condutores.error} tentar={() => condutores.refetch()} />}
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="Condutores ativos" valor={c?.total} icone={<Badge />} cor={theme.palette.primary.main}
              descricao="Cadastros ativos" aoClicar={() => navigate('/condutores')} />
          </Grid>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="Liberados para o POOL" valor={c?.liberados_pool} icone={<VerifiedUser />} cor={theme.palette.success.main}
              descricao="Podem receber reservas e empréstimos" aoClicar={() => navigate('/condutores?liberado_pool=true')} />
          </Grid>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="CNH vence em até 30 dias" valor={c?.cnh_vencendo} icone={<Update />} cor={theme.palette.warning.main}
              aoClicar={() => navigate('/condutores?situacao_cnh=vencendo')} />
          </Grid>
          <Grid size={{ xs: 6, lg: 3 }}>
            <Indicador titulo="CNH vencida" valor={c?.cnh_vencida} icone={<EventBusy />} cor={theme.palette.error.main}
              descricao="Não podem receber veículos" aoClicar={() => navigate('/condutores?situacao_cnh=vencida')} />
          </Grid>
        </Grid>
      </Secao>

      <Typography variant="caption" color="text.secondary" component="p">
        Veículos e condutores inativos não entram nos números. Os horários seguem o fuso de Brasília.
      </Typography>
    </Box>
  );
};

export default InicioPage;
