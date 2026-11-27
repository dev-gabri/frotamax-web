import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type Permitidos<T> = Partial<Record<keyof T, readonly string[]>>;

/** Monta os filtros a partir da URL, aceitando somente valores conhecidos para cada campo. */
function lerFiltros<T extends object>(params: URLSearchParams, iniciais: T, permitidos: Permitidos<T>): T {
  const daUrl: Record<string, string> = {};
  for (const [campo, valores] of Object.entries(permitidos) as [string, readonly string[]][]) {
    const valor = params.get(campo);
    if (valor !== null && valores.includes(valor)) daUrl[campo] = valor;
  }
  return { ...iniciais, ...daUrl };
}

/**
 * Filtros de uma tela que também podem chegar pela URL (atalhos da tela inicial, Sprint 04).
 * Quando a URL muda, por exemplo ao clicar no menu, os filtros voltam ao padrão mais os da URL.
 * Retorna os filtros, a função para alterá-los e a função que limpa os filtros da URL.
 */
export function useFiltrosDaUrl<T extends object>(iniciais: T, permitidos: Permitidos<T>, aoMudarUrl?: () => void) {
  const [params, setParams] = useSearchParams();
  const [filtros, setFiltros] = useState<T>(() => lerFiltros(params, iniciais, permitidos));
  const chave = params.toString();
  const primeiraVez = useRef(true);

  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    setFiltros(lerFiltros(params, iniciais, permitidos));
    aoMudarUrl?.();
    // A URL é a única dependência: os demais valores são constantes da tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const limparUrl = () => { if (chave) setParams({}, { replace: true }); };
  return [filtros, setFiltros, limparUrl] as const;
}
