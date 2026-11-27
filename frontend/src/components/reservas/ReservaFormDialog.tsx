import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  ListItemText,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DirectionsCar, Event } from '@mui/icons-material';
import { ApiError } from '../../services/apiService';
import { condutorService } from '../../services/condutorService';
import { reservaService } from '../../services/reservaService';
import { ReservaInput, TIPO_LABELS, TipoReserva } from '../../types';
import { dataBR, deInputDataHora, paraInputDataHora } from '../../utils/datas';

interface Props {
  open: boolean;
  salvando: boolean;
  erroApi: ApiError | null;
  onClose: () => void;
  onSubmit: (dados: ReservaInput) => void;
}

interface Form {
  tipo: TipoReserva;
  inicio: string;
  fim: string;
  veiculo_id: string;
  condutor_id: string;
  finalidade: string;
  observacoes: string;
}

/** Próxima hora cheia a partir de agora, deslocada em horas. */
function horaCheia(deslocamentoHoras: number) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1 + deslocamentoHoras);
  return paraInputDataHora(d);
}

const formInicial = (): Form => ({
  tipo: 'reserva', inicio: horaCheia(0), fim: horaCheia(4), veiculo_id: '', condutor_id: '', finalidade: '', observacoes: '',
});

/** Data local AAAA-MM-DD de um valor datetime-local. */
const diaDe = (valor: string) => valor.slice(0, 10);

/**
 * Registro de reserva (uso futuro) ou empréstimo (retirada imediata).
 * Só são oferecidos os veículos POOL livres no período e os condutores liberados com CNH válida.
 * O servidor confirma todas as regras e recusa períodos conflitantes.
 */
const ReservaFormDialog: React.FC<Props> = ({ open, salvando, erroApi, onClose, onSubmit }) => {
  const [form, setForm] = useState<Form>(formInicial);
  const [erros, setErros] = useState<Partial<Record<keyof Form, string>>>({});
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (open) { setForm(formInicial()); setErros({}); }
  }, [open]);

  const emprestimo = form.tipo === 'emprestimo';
  const inicioEfetivo = emprestimo ? paraInputDataHora(new Date()) : form.inicio;
  const periodoValido = !!form.fim && (emprestimo || !!form.inicio) && new Date(form.fim) > new Date(inicioEfetivo);

  const disponiveis = useQuery({
    queryKey: ['disponibilidade', form.tipo, emprestimo ? null : form.inicio, form.fim],
    queryFn: () => reservaService.disponibilidade(form.tipo, deInputDataHora(form.fim), emprestimo ? undefined : deInputDataHora(form.inicio)),
    enabled: open && periodoValido,
  });

  const condutores = useQuery({
    queryKey: ['condutores', { liberado_pool: 'true', ativo: 'true' }],
    queryFn: () => condutorService.listar({ liberado_pool: 'true', ativo: 'true' }),
    enabled: open,
  });

  // Veículo escolhido deixa de valer se ficar indisponível no novo período
  useEffect(() => {
    if (form.veiculo_id && disponiveis.data && !disponiveis.data.some((v) => v.id === form.veiculo_id)) {
      setForm((f) => ({ ...f, veiculo_id: '' }));
    }
  }, [disponiveis.data, form.veiculo_id]);

  const condutorEscolhido = useMemo(
    () => condutores.data?.find((c) => c.id === form.condutor_id),
    [condutores.data, form.condutor_id]
  );

  const set = (campo: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  const validar = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!emprestimo && !form.inicio) e.inicio = 'Informe o início.';
    else if (!emprestimo && new Date(form.inicio) < new Date(Date.now() - 60_000)) e.inicio = 'O início não pode estar no passado.';
    if (!form.fim) e.fim = 'Informe a previsão de devolução.';
    else if (new Date(form.fim) <= new Date(inicioEfetivo)) e.fim = 'Deve ser posterior ao início.';
    if (!form.veiculo_id) e.veiculo_id = 'Selecione um veículo disponível.';
    if (!form.condutor_id) e.condutor_id = 'Selecione o condutor.';
    else if (condutorEscolhido && form.fim && condutorEscolhido.cnh_validade < diaDe(form.fim)) {
      e.condutor_id = `A CNH vence em ${dataBR(condutorEscolhido.cnh_validade)}, antes do fim do período.`;
    }
    if (form.finalidade.trim().length < 3) e.finalidade = 'Informe a finalidade da utilização.';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    onSubmit({
      tipo: form.tipo,
      veiculo_id: form.veiculo_id,
      condutor_id: form.condutor_id,
      ...(!emprestimo && { inicio: deInputDataHora(form.inicio) }),
      fim_previsto: deInputDataHora(form.fim),
      finalidade: form.finalidade.trim(),
      observacoes: form.observacoes.trim() || null,
    });
  };

  // Condutores com CNH vencida não aparecem para seleção
  const condutoresAptos = (condutores.data ?? []).filter((c) => c.situacao_cnh !== 'vencida');

  return (
    <Dialog open={open} onClose={salvando ? undefined : onClose} fullWidth maxWidth="md" fullScreen={telaPequena}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Nova reserva ou empréstimo</DialogTitle>
        <DialogContent dividers>
          {erroApi && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {erroApi.message}
              {erroApi.details && (
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {erroApi.details.map((d) => <li key={d}>{d}</li>)}
                </ul>
              )}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={12}>
              <ToggleButtonGroup
                exclusive
                fullWidth
                color="primary"
                value={form.tipo}
                onChange={(_e, valor: TipoReserva | null) => valor && setForm((f) => ({ ...f, tipo: valor, veiculo_id: '' }))}
                aria-label="Tipo de registro"
                disabled={salvando}
              >
                <ToggleButton value="reserva"><Event sx={{ mr: 1 }} />Reserva (uso futuro)</ToggleButton>
                <ToggleButton value="emprestimo"><DirectionsCar sx={{ mr: 1 }} />Empréstimo (retirada agora)</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {emprestimo
                  ? 'O veículo é entregue ao condutor agora e passa para a situação "Em uso".'
                  : 'O período fica bloqueado para o veículo até a retirada ou o cancelamento.'}
              </Typography>
            </Grid>
            {!emprestimo && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="reserva-inicio" label="Início (retirada prevista)" type="datetime-local" required
                  value={form.inicio} onChange={set('inicio')} InputLabelProps={{ shrink: true }}
                  error={!!erros.inicio} helperText={erros.inicio} disabled={salvando}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: emprestimo ? 12 : 6 }}>
              <TextField
                id="reserva-fim" label="Previsão de devolução" type="datetime-local" required
                value={form.fim} onChange={set('fim')} InputLabelProps={{ shrink: true }}
                error={!!erros.fim} helperText={erros.fim} disabled={salvando}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                id="reserva-veiculo" select label="Veículo POOL disponível" required
                value={form.veiculo_id} onChange={set('veiculo_id')}
                error={!!erros.veiculo_id}
                helperText={erros.veiculo_id
                  || (!periodoValido ? 'Informe um período válido para ver os veículos livres.'
                    : disponiveis.isFetching ? 'Consultando disponibilidade...'
                      : `${disponiveis.data?.length ?? 0} veículo(s) livre(s) no período.`)}
                disabled={salvando || !periodoValido || disponiveis.isFetching}
              >
                {(disponiveis.data ?? []).map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    <ListItemText primary={`${v.placa} — ${v.marca} ${v.modelo}`} secondary={`${v.codigo} · ${TIPO_LABELS[v.tipo]} · ${v.unidade}`} />
                  </MenuItem>
                ))}
                {disponiveis.isSuccess && disponiveis.data.length === 0 && (
                  <MenuItem disabled value="">Nenhum veículo POOL livre neste período</MenuItem>
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                id="reserva-condutor" select label="Condutor" required
                value={form.condutor_id} onChange={set('condutor_id')}
                error={!!erros.condutor_id}
                helperText={erros.condutor_id
                  || (condutorEscolhido?.situacao_cnh === 'vencendo' ? `Atenção: CNH vence em ${dataBR(condutorEscolhido.cnh_validade)}.`
                    : 'Somente condutores liberados para o POOL e com CNH válida.')}
                disabled={salvando || condutores.isLoading}
              >
                {condutoresAptos.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <ListItemText primary={c.nome} secondary={`${c.matricula} · CNH ${c.cnh_categoria} válida até ${dataBR(c.cnh_validade)}`} />
                  </MenuItem>
                ))}
                {condutores.isSuccess && condutoresAptos.length === 0 && (
                  <MenuItem disabled value="">Nenhum condutor liberado com CNH válida</MenuItem>
                )}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                id="reserva-finalidade" label="Finalidade" required placeholder="Ex.: visita técnica à Unidade Operacional"
                value={form.finalidade} onChange={set('finalidade')} inputProps={{ maxLength: 200 }}
                error={!!erros.finalidade} helperText={erros.finalidade} disabled={salvando}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                id="reserva-observacoes" label="Observações" multiline minRows={2}
                value={form.observacoes} onChange={set('observacoes')} inputProps={{ maxLength: 500 }} disabled={salvando}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando} startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {emprestimo ? 'Registrar empréstimo' : 'Registrar reserva'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ReservaFormDialog;
