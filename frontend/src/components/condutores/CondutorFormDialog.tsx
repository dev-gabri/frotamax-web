import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid2 as Grid,
  MenuItem,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { CATEGORIAS_CNH, CategoriaCnh, Condutor, CondutorInput } from '../../types';
import { ApiError } from '../../services/apiService';

interface Props {
  open: boolean;
  condutor: Condutor | null; // null = cadastro
  salvando: boolean;
  erroApi: ApiError | null;
  onClose: () => void;
  onSubmit: (dados: CondutorInput) => void;
}

interface Form {
  nome: string;
  matricula: string;
  cnh_categoria: string;
  cnh_validade: string;
  telefone: string;
  observacoes: string;
  liberado_pool: boolean;
  ativo: boolean;
}

const VAZIO: Form = {
  nome: '', matricula: '', cnh_categoria: 'B', cnh_validade: '', telefone: '', observacoes: '', liberado_pool: false, ativo: true,
};

const hojeISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Cadastro e edição de condutor. Da CNH são guardadas apenas a categoria e a validade
 * (minimização de dados pessoais). O servidor valida novamente todos os campos.
 */
const CondutorFormDialog: React.FC<Props> = ({ open, condutor, salvando, erroApi, onClose, onSubmit }) => {
  const [form, setForm] = useState<Form>(VAZIO);
  const [erros, setErros] = useState<Partial<Record<keyof Form, string>>>({});
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (!open) return;
    setErros({});
    setForm(
      condutor
        ? {
            nome: condutor.nome, matricula: condutor.matricula, cnh_categoria: condutor.cnh_categoria,
            cnh_validade: condutor.cnh_validade, telefone: condutor.telefone ?? '', observacoes: condutor.observacoes ?? '',
            liberado_pool: condutor.liberado_pool, ativo: condutor.ativo,
          }
        : VAZIO
    );
  }, [open, condutor]);

  // A mensagem de erro do campo some assim que ele é corrigido (BUG-03)
  const set = (campo: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual));
  };

  const validar = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (form.nome.trim().length < 3) e.nome = 'Informe o nome completo.';
    if (!form.matricula.trim()) e.matricula = 'Informe a matrícula.';
    else if (!/^[A-Za-z0-9.-]+$/.test(form.matricula.trim())) e.matricula = 'Use apenas letras, números, ponto e hífen.';
    if (!form.cnh_categoria) e.cnh_categoria = 'Selecione a categoria.';
    if (!form.cnh_validade) e.cnh_validade = 'Informe a validade da CNH.';
    if (form.telefone.trim() && !/^[0-9()+\s-]{8,20}$/.test(form.telefone.trim())) e.telefone = 'Use apenas números, espaços, parênteses, + e hífen.';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    onSubmit({
      nome: form.nome.trim(),
      matricula: form.matricula.trim().toUpperCase(),
      cnh_categoria: form.cnh_categoria as CategoriaCnh,
      cnh_validade: form.cnh_validade,
      telefone: form.telefone.trim() || null,
      liberado_pool: form.liberado_pool,
      observacoes: form.observacoes.trim() || null,
      ...(condutor && { ativo: form.ativo }),
    });
  };

  const campo = (nome: keyof Form, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField
      {...extra}
      id={`condutor-${nome}`}
      label={label}
      value={form[nome] as string}
      onChange={set(nome)}
      error={!!erros[nome]}
      helperText={erros[nome] || extra.helperText}
      disabled={salvando}
    />
  );

  const cnhVencida = !!form.cnh_validade && form.cnh_validade < hojeISO();

  return (
    <Dialog open={open} onClose={salvando ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={telaPequena}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{condutor ? `Editar condutor ${condutor.nome}` : 'Cadastrar condutor'}</DialogTitle>
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
            <Grid size={12}>{campo('nome', 'Nome completo', { required: true, autoFocus: true, inputProps: { maxLength: 120 } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{campo('matricula', 'Matrícula', { required: true, inputProps: { maxLength: 20, style: { textTransform: 'uppercase' } } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{campo('telefone', 'Telefone (opcional)', { inputProps: { maxLength: 20, inputMode: 'tel' } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {campo('cnh_categoria', 'Categoria da CNH', { select: true, required: true, children: CATEGORIAS_CNH.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>) })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {campo('cnh_validade', 'Validade da CNH', {
                type: 'date', required: true, InputLabelProps: { shrink: true },
                helperText: cnhVencida ? 'CNH vencida: o condutor não poderá receber veículos.' : undefined,
              })}
            </Grid>
            <Grid size={12}>
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 2, py: 1 }}>
                <FormControlLabel
                  control={<Switch checked={form.liberado_pool} onChange={(e) => setForm((f) => ({ ...f, liberado_pool: e.target.checked }))} disabled={salvando} />}
                  label="Liberado para utilizar veículos POOL"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Somente condutores liberados pelo Departamento de Frotas podem receber reservas e empréstimos.
                </Typography>
              </Box>
            </Grid>
            {condutor && (
              <Grid size={12}>
                <FormControlLabel
                  control={<Switch checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} disabled={salvando} />}
                  label={form.ativo ? 'Cadastro ativo' : 'Cadastro inativo'}
                />
              </Grid>
            )}
            <Grid size={12}>{campo('observacoes', 'Observações', { multiline: true, minRows: 2, inputProps: { maxLength: 500 } })}</Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando} startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {condutor ? 'Salvar alterações' : 'Cadastrar condutor'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CondutorFormDialog;
