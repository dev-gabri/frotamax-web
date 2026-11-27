import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Grid2 as Grid,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { KeyboardReturn } from '@mui/icons-material';
import { DevolucaoInput, Reserva, TIPO_RESERVA_LABELS } from '../../types';
import { ApiError } from '../../services/apiService';
import { dataHora, deInputDataHora, numeroReserva, paraInputDataHora } from '../../utils/datas';

interface Props {
  reserva: Reserva | null;
  salvando: boolean;
  erroApi: ApiError | null;
  onClose: () => void;
  onConfirm: (dados: DevolucaoInput) => void;
}

const formatoKm = new Intl.NumberFormat('pt-BR');
const km = (valor: number) => `${formatoKm.format(valor)} km`;

type Erros = Partial<Record<'devolvidaEm' | 'km' | 'observacao', string>>;

/**
 * Registro da devolução (Sprint 03). Regras combinadas com o Departamento de Frotas:
 * data e hora, quilometragem de chegada (não menor que a registrada) e observação; o veículo
 * pode ser enviado para manutenção no próprio registro. A API confere novamente todas as regras.
 */
const DevolucaoDialog: React.FC<Props> = ({ reserva, salvando, erroApi, onClose, onConfirm }) => {
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('sm'));
  const [devolvidaEm, setDevolvidaEm] = useState('');
  const [quilometragem, setQuilometragem] = useState('');
  const [observacao, setObservacao] = useState('');
  const [manutencao, setManutencao] = useState(false);
  const [erros, setErros] = useState<Erros>({});

  useEffect(() => {
    if (reserva) {
      setDevolvidaEm(paraInputDataHora(new Date()));
      setQuilometragem('');
      setObservacao('');
      setManutencao(false);
      setErros({});
    }
  }, [reserva]);

  const kmAtual = reserva?.veiculo.quilometragem ?? 0;
  const kmRetirada = reserva?.km_retirada ?? kmAtual;
  const percorridos = useMemo(() => {
    const n = Number(quilometragem);
    return quilometragem !== '' && Number.isInteger(n) && n >= kmRetirada ? n - kmRetirada : null;
  }, [quilometragem, kmRetirada]);

  const limparErro = (campo: keyof Erros) => setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));

  const validar = (): Erros => {
    const e: Erros = {};
    if (!devolvidaEm) e.devolvidaEm = 'Informe a data e a hora da devolução.';
    else {
      const quando = new Date(devolvidaEm);
      if (quando.getTime() > Date.now() + 60_000) e.devolvidaEm = 'A devolução não pode estar no futuro.';
      else if (reserva?.retirada_em && quando < new Date(new Date(reserva.retirada_em).setSeconds(0, 0))) {
        e.devolvidaEm = `A devolução não pode ser anterior à retirada (${dataHora(reserva.retirada_em)}).`;
      }
    }
    const n = Number(quilometragem);
    if (quilometragem === '') e.km = 'Informe a quilometragem de chegada.';
    else if (!Number.isInteger(n) || n < 0) e.km = 'Informe a quilometragem em quilômetros inteiros.';
    else if (n < kmAtual) e.km = `A quilometragem não pode ser menor que a registrada para o veículo (${km(kmAtual)}).`;
    if (manutencao && observacao.trim().length < 5) e.observacao = 'Descreva o problema encontrado (mínimo de 5 caracteres).';
    return e;
  };

  const confirmar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validar();
    setErros(e);
    if (Object.values(e).some(Boolean)) return;
    onConfirm({
      devolvida_em: deInputDataHora(devolvidaEm),
      km_devolucao: Number(quilometragem),
      observacao: observacao.trim() || null,
      enviar_manutencao: manutencao,
    });
  };

  return (
    <Dialog open={!!reserva} onClose={salvando ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={telaPequena}>
      <form onSubmit={confirmar} noValidate>
        <DialogTitle>Registrar devolução{reserva && ` — ${TIPO_RESERVA_LABELS[reserva.tipo].toLowerCase()} nº ${numeroReserva(reserva.numero)}`}</DialogTitle>
        <DialogContent dividers>
          {erroApi && <Alert severity="error" sx={{ mb: 2 }} role="alert">{erroApi.message}</Alert>}
          {reserva && (
            <Box mb={2}>
              <Typography variant="body2">
                <strong>{reserva.veiculo.placa}</strong> ({reserva.veiculo.marca} {reserva.veiculo.modelo}) com{' '}
                <strong>{reserva.condutor.nome}</strong>.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Retirada em {reserva.retirada_em ? dataHora(reserva.retirada_em) : '—'} · previsão de devolução {dataHora(reserva.fim_previsto)}
              </Typography>
              {reserva.atrasada && (
                <Alert severity="warning" sx={{ mt: 1 }}>A devolução está atrasada: a previsão era {dataHora(reserva.fim_previsto)}.</Alert>
              )}
            </Box>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                id="devolucao-data" label="Data e hora da devolução" type="datetime-local" required
                value={devolvidaEm} onChange={(e) => { setDevolvidaEm(e.target.value); limparErro('devolvidaEm'); }}
                error={!!erros.devolvidaEm} helperText={erros.devolvidaEm} disabled={salvando}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                id="devolucao-km" label="Quilometragem de chegada" type="number" required autoFocus
                value={quilometragem} onChange={(e) => { setQuilometragem(e.target.value); limparErro('km'); }}
                inputProps={{ min: kmAtual, step: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }}
                error={!!erros.km}
                helperText={erros.km || (percorridos !== null
                  ? `Percorridos nesta utilização: ${km(percorridos)}`
                  : `Na retirada: ${km(kmRetirada)}`)}
                disabled={salvando}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                id="devolucao-observacao" label={manutencao ? 'Problema encontrado' : 'Observação'} multiline minRows={2}
                required={manutencao} placeholder={manutencao ? 'Descreva o problema para a manutenção' : 'Ex.: sem ocorrências'}
                value={observacao} onChange={(e) => { setObservacao(e.target.value); limparErro('observacao'); }}
                inputProps={{ maxLength: 500 }} error={!!erros.observacao} helperText={erros.observacao}
                disabled={salvando}
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Checkbox checked={manutencao} onChange={(e) => { setManutencao(e.target.checked); limparErro('observacao'); }} disabled={salvando} />}
                label="O veículo voltou com problema: enviar para manutenção"
              />
              <FormHelperText sx={{ mt: -0.5 }}>
                {manutencao
                  ? 'O veículo ficará “Em manutenção” e não poderá ser reservado até ser liberado na tela de Veículos.'
                  : 'Sem esta opção, o veículo volta a ficar “Disponível”.'}
              </FormHelperText>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={salvando}>Voltar</Button>
          <Button
            type="submit" variant="contained" disabled={salvando}
            startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <KeyboardReturn />}
          >
            Registrar devolução
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DevolucaoDialog;
