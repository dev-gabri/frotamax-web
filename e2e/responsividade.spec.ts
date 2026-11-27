import { expect, test } from '@playwright/test';
import { abrirMenu, entrar, SENHA } from './apoio';

/**
 * Responsividade (Sprint 04, RNF03/CA12): as quatro telas do sistema em larguras de celular,
 * tablet e computador, sem rolagem horizontal e com o menu acessível.
 * Verifica o navegador e as larguras simuladas pelo Playwright; não substitui o uso em aparelhos reais.
 */
test.skip(!SENHA, 'Informe a senha dos usuários de demonstração em E2E_SENHA (a mesma de SEED_SENHA).');

const LARGURAS = [
  { nome: 'celular', width: 390, height: 844 },
  { nome: 'tablet', width: 768, height: 1024 },
  { nome: 'notebook', width: 1366, height: 768 },
  { nome: 'monitor', width: 1920, height: 1080 },
];
const TELAS = [
  { menu: 'Início', titulo: 'Início' },
  { menu: 'Veículos', titulo: 'Veículos' },
  { menu: 'Condutores', titulo: 'Condutores' },
  { menu: 'Reservas e empréstimos', titulo: 'Reservas e empréstimos' },
];

for (const tela of LARGURAS) {
  test(`E2E-09 — telas sem rolagem horizontal em ${tela.nome} (${tela.width} px)`, async ({ page }) => {
    await page.setViewportSize({ width: tela.width, height: tela.height });
    await entrar(page, 'gestor@frotamax.local');
    for (const { menu, titulo } of TELAS) {
      await abrirMenu(page, menu);
      await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const largura = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(largura, `${titulo} em ${tela.width} px`).toBeLessThanOrEqual(tela.width);
    }
    // Em telas pequenas o menu lateral vira o botão "Abrir menu"
    const botaoMenu = page.getByRole('button', { name: 'Abrir menu' });
    if (tela.width < 900) await expect(botaoMenu).toBeVisible();
    else await expect(botaoMenu).toBeHidden();
  });
}

test('E2E-10 — login pelo teclado: Tab entre os campos e Enter para entrar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').focus();
  await page.keyboard.type('consulta@frotamax.local');
  await page.keyboard.press('Tab');
  await page.keyboard.type(SENHA!);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
});
