/** Fuso horário usado nas mensagens exibidas ao usuário (Anápolis-GO). */
export const FUSO_APLICACAO = process.env.FUSO_APLICACAO || 'America/Sao_Paulo';

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_APLICACAO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_APLICACAO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Ex.: 27/11/2026 14:30 */
export function dataHora(valor: Date | string): string {
  return formatoDataHora.format(new Date(valor)).replace(',', '');
}

/** Data AAAA-MM-DD no fuso da aplicação (usada para comparar com a validade da CNH). */
export function dataLocalISO(valor: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_APLICACAO, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(valor).map((p) => [p.type, p.value])
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Ex.: 10/05/2027 a partir de 2027-05-10 */
export function dataBR(valorISO: string): string {
  const [ano, mes, dia] = valorISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

export { formatoData };
