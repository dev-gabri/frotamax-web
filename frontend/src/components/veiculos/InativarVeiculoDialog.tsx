import React, { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { Veiculo } from '../../types';
import { ApiError } from '../../services/apiService';

interface Props {
  veiculo: Veiculo | null;
  salvando: boolean;
  erroApi: ApiError | null;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

/**
 * Inativação de veículo (Sprint 04): o motivo é obrigatório e fica registrado com a data e o responsável.
 * O veículo sai das listas e da disponibilidade, mas o histórico de utilização é preservado.
 */
const InativarVeiculoDialog: React.FC<Props> = ({ veiculo, salvando, erroApi, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => { if (veiculo) { setMotivo(''); setErro(''); } }, [veiculo]);

  const confirmar = (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) { setErro('Descreva o motivo da inativação (mínimo de 5 caracteres).'); return; }
    onConfirm(motivo.trim());
  };

  return (
    <Dialog open={!!veiculo} onClose={salvando ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={confirmar} noValidate>
        <DialogTitle>Inativar o veículo {veiculo?.placa}</DialogTitle>
        <DialogContent dividers>
          {erroApi && <Alert severity="error" sx={{ mb: 2 }} role="alert">{erroApi.message}</Alert>}
          {veiculo && (
            <Typography variant="body2" mb={2}>
              {veiculo.marca} {veiculo.modelo} ({veiculo.codigo}) deixará de aparecer na lista de veículos, nos indicadores
              e na disponibilidade para reservas. O histórico de utilização continua disponível, e o cadastro pode ser
              reativado depois pelo filtro &quot;Cadastro: Inativos&quot;.
            </Typography>
          )}
          <TextField
            id="inativacao-motivo" label="Motivo da inativação" required multiline minRows={2} autoFocus
            placeholder="Ex.: veículo vendido, devolvido à locadora ou baixado da frota"
            value={motivo} onChange={(e) => { setMotivo(e.target.value); if (erro) setErro(''); }} inputProps={{ maxLength: 300 }}
            error={!!erro} helperText={erro} disabled={salvando}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={salvando}>Voltar</Button>
          <Button type="submit" color="error" variant="contained" disabled={salvando} startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}>
            Inativar veículo
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default InativarVeiculoDialog;
