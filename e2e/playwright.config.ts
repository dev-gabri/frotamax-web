import { defineConfig } from '@playwright/test';

/**
 * Testes de navegador do Frota Max Web (Sprint 03).
 * Rodam contra o sistema já iniciado (npm run dev) e com os dados fictícios do seed.
 * Usam o navegador instalado no computador: Microsoft Edge no Windows e Google Chrome nos demais
 * sistemas (troque com a variável E2E_NAVEGADOR=chrome ou msedge). Nenhum navegador é baixado.
 */
export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:3000',
    channel: process.env.E2E_NAVEGADOR || (process.platform === 'win32' ? 'msedge' : 'chrome'),
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1366, height: 768 },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  outputDir: './resultados',
});
