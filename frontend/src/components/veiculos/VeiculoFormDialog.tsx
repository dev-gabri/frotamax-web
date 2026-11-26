import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  MenuItem,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  MODALIDADE_LABELS,
  Modalidade,
  SITUACAO_LABELS,
  Situacao,
  TIPO_LABELS,
  TipoVeiculo,
  Veiculo,
  VeiculoInput,
} from '../../types';
import { ApiError } from '../../services/apiService';

interface Props {
  open: boolean;
  veiculo: Veiculo | null; // null = cadastro
  salvando: boolean;
  erroApi: ApiError | null;
  onClose: () => void;
  onSubmit: (dados: VeiculoInput) => void;
}

type Form = Record<keyof VeiculoInput, string>;

const VAZIO: Form = {
  codigo: '', placa: '', marca: '', modelo: '', ano_modelo: '', tipo: '', unidade: '',
  quilometragem: '0', modalidade: 'pool', situacao: 'disponivel', observacoes: '',
};

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const ANO_MAXIMO = new Date().getFullYear() + 1;

/** Normaliza a placa como o servidor: maiúsculas, sem hífen e sem espaços. */
const normalizarPlaca = (v: string) => v.toUpperCase().replace(/[\s-]/g, '');

/**
 * Formulário de cadastro e edição de veículo.
 * Valida os campos antes do envio (o servidor valida novamente) e exibe os erros retornados pela API.
 */
const VeiculoFormDialog: React.FC<Props> = ({ open, veiculo, salvando, erroApi, onClose, onSubmit }) => {
  const [form, setForm] = useState<Form>(VAZIO);
  const [erros, setErros] = useState<Partial<Record<keyof Form, string>>>({});
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (!open) return;
    setErros({});
    setForm(
      veiculo
        ? {
            codigo: veiculo.codigo, placa: veiculo.placa, marca: veiculo.marca, modelo: veiculo.modelo,
            ano_modelo: veiculo.ano_modelo ? String(veiculo.ano_modelo) : '', tipo: veiculo.tipo,
            unidade: veiculo.unidade, quilometragem: String(veiculo.quilometragem),
            modalidade: veiculo.modalidade, situacao: veiculo.situacao, observacoes: veiculo.observacoes ?? '',
          }
        : VAZIO
    );
  }, [open, veiculo]);

  const set = (campo: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  const validar = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    const placa = normalizarPlaca(form.placa);
    if (!form.codigo.trim()) e.codigo = 'Informe o código interno.';
    else if (!/^[A-Za-z0-9-]+$/.test(form.codigo.trim())) e.codigo = 'Use apenas letras, números e hífen.';
    if (!placa) e.placa = 'Informe a placa.';
    else if (!PLACA_REGEX.test(placa)) e.placa = 'Use o padrão ABC1234 ou ABC1D23.';
    if (form.marca.trim().length < 2) e.marca = 'Informe a marca.';
    if (!form.modelo.trim()) e.modelo = 'Informe o modelo.';
    if (!form.tipo) e.tipo = 'Selecione o tipo.';
    if (form.unidade.trim().length < 2) e.unidade = 'Informe a unidade.';
    if (form.ano_modelo) {
      const ano = Number(form.ano_modelo);
      if (!Number.isInteger(ano) || ano < 1980 || ano > ANO_MAXIMO) e.ano_modelo = `Ano entre 1980 e ${ANO_MAXIMO}.`;
    }
    const km = Number(form.quilometragem);
    if (form.quilometragem === '' || !Number.isInteger(km) || km < 0) e.quilometragem = 'Informe um número inteiro maior ou igual a zero.';
    else if (veiculo && km < veiculo.quilometragem) e.quilometragem = `Não pode ser menor que a registrada (${veiculo.quilometragem.toLocaleString('pt-BR')} km).`;
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    onSubmit({
      codigo: form.codigo.trim().toUpperCase(),
      placa: normalizarPlaca(form.placa),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      ano_modelo: form.ano_modelo ? Number(form.ano_modelo) : null,
      tipo: form.tipo as TipoVeiculo,
      unidade: form.unidade.trim(),
      quilometragem: Number(form.quilometragem),
      modalidade: form.modalidade as Modalidade,
      situacao: form.situacao as Situacao,
      observacoes: form.observacoes.trim() || null,
    });
  };

  const campo = (nome: keyof Form, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField
      {...extra}
      id={`veiculo-${nome}`}
      label={label}
      value={form[nome]}
      onChange={set(nome)}
      error={!!erros[nome]}
      helperText={erros[nome] || extra.helperText}
      disabled={salvando}
    />
  );

  return (
    <Dialog open={open} onClose={salvando ? undefined : onClose} fullWidth maxWidth="md" fullScreen={telaPequena}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{veiculo ? `Editar veículo ${veiculo.placa}` : 'Cadastrar veículo'}</DialogTitle>
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
            <Grid size={{ xs: 12, sm: 4 }}>{campo('codigo', 'Código interno', { required: true, autoFocus: true, inputProps: { maxLength: 20 } })}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{campo('placa', 'Placa', { required: true, inputProps: { maxLength: 8, style: { textTransform: 'uppercase' } }, helperText: 'Ex.: ABC1D23' })}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              {campo('tipo', 'Tipo', { select: true, required: true, children: Object.entries(TIPO_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>) })}
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{campo('marca', 'Marca', { required: true, inputProps: { maxLength: 60 } })}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{campo('modelo', 'Modelo', { required: true, inputProps: { maxLength: 80 } })}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{campo('ano_modelo', 'Ano do modelo', { type: 'number', inputProps: { min: 1980, max: ANO_MAXIMO } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{campo('unidade', 'Unidade', { required: true, inputProps: { maxLength: 80 } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{campo('quilometragem', 'Quilometragem atual (km)', { type: 'number', required: true, inputProps: { min: 0, step: 1 } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {campo('modalidade', 'Modalidade de uso', { select: true, required: true, children: Object.entries(MODALIDADE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>) })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {campo('situacao', 'Situação', { select: true, required: true, children: Object.entries(SITUACAO_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>) })}
            </Grid>
            <Grid size={12}>{campo('observacoes', 'Observações', { multiline: true, minRows: 2, inputProps: { maxLength: 500 } })}</Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando} startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {veiculo ? 'Salvar alterações' : 'Cadastrar veículo'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default VeiculoFormDialog;
