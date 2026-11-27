import React, { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { Reserva } from '../../types';
import { ApiError } from '../../services/apiService';
import { numeroReserva, periodo } from '../../utils/datas';

interface Props {
  reserva: Reserva | null;
  salvando: boolean;
  erroApi: ApiError | null;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

/** Cancelamento de reserva agendada: o motivo é obrigatório e fica registrado no histórico. */
const CancelarReservaDialog: React.FC<Props> = ({ reserva, salvando, erroApi, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => { if (reserva) { setMotivo(''); setErro(''); } }, [reserva]);

  const confirmar = (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) { setErro('Descreva o motivo do cancelamento (mínimo de 5 caracteres).'); return; }
    onConfirm(motivo.trim());
  };

  return (
    <Dialog open={!!reserva} onClose={salvando ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={confirmar} noValidate>
        <DialogTitle>Cancelar reserva nº {reserva && numeroReserva(reserva.numero)}</DialogTitle>
        <DialogContent dividers>
          {erroApi && <Alert severity="error" sx={{ mb: 2 }} role="alert">{erroApi.message}</Alert>}
          {reserva && (
            <Typography variant="body2" mb={2}>
              {reserva.veiculo.placa} ({reserva.veiculo.modelo}) para {reserva.condutor.nome}, {periodo(reserva.inicio, reserva.fim_previsto)}.
              O período ficará livre para outras reservas.
            </Typography>
          )}
          <TextField
            id="cancelamento-motivo" label="Motivo do cancelamento" required multiline minRows={2} autoFocus
            value={motivo} onChange={(e) => setMotivo(e.target.value)} inputProps={{ maxLength: 300 }}
            error={!!erro} helperText={erro} disabled={salvando}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={salvando}>Voltar</Button>
          <Button type="submit" color="error" variant="contained" disabled={salvando} startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}>
            Cancelar reserva
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CancelarReservaDialog;
