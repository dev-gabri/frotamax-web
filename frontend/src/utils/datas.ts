/** Formatação de datas no padrão brasileiro, no fuso do navegador. */
const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dataFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const horaFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** 27/11/2026 14:30 */
export const dataHora = (iso: string) => dataHoraFmt.format(new Date(iso)).replace(',', '');

/** 10/05/2027 a partir de AAAA-MM-DD (sem conversão de fuso) */
export const dataBR = (isoData: string) => isoData.split('-').reverse().join('/');

/** Período compacto: "28/11/2026 08:00 – 17:00" no mesmo dia, ou datas completas. */
export function periodo(inicio: string, fim: string) {
  const a = new Date(inicio);
  const b = new Date(fim);
  if (dataFmt.format(a) === dataFmt.format(b)) return `${dataFmt.format(a)} ${horaFmt.format(a)} – ${horaFmt.format(b)}`;
  return `${dataHora(inicio)} – ${dataHora(fim)}`;
}

/** Valor para <input type="datetime-local"> (AAAA-MM-DDTHH:mm, hora local). */
export function paraInputDataHora(data: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`;
}

/** Converte o valor do <input type="datetime-local"> para ISO (UTC), preservando o horário local escolhido. */
export const deInputDataHora = (valor: string) => new Date(valor).toISOString();

/** Número da reserva com 4 dígitos: 0007 */
export const numeroReserva = (n: number) => String(n).padStart(4, '0');
