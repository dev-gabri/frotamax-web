import { expect, Page } from '@playwright/test';

/**
 * Funções comuns dos testes de navegador (Sprint 04).
 * Cada teste cria os próprios veículos e condutores, com identificação única, e os inativa ao final,
 * para não alterar os dados fictícios usados na demonstração.
 */
export const SENHA = process.env.E2E_SENHA;

export async function entrar(page: Page, email: string, irParaLogin = true) {
  if (irParaLogin) await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: false }).first().fill(SENHA!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Navega pelo menu principal (a tela inicial também tem botões com os mesmos nomes). */
export async function abrirMenu(page: Page, item: string) {
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  const botaoMenu = page.getByRole('button', { name: 'Abrir menu' }); // telas pequenas
  await expect(menu.or(botaoMenu).first()).toBeVisible();
  if (!(await menu.isVisible())) await botaoMenu.click();
  await menu.getByRole('button', { name: item, exact: true }).click();
}

export const dataHoraLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Sufixo numérico de 6 dígitos para nomes e códigos de cada execução. */
export const sufixoUnico = () => Date.now().toString().slice(-6);

/** Placa válida no padrão Mercosul e diferente a cada execução (ex.: XKQ3B71). */
let sequencia = 0;
export function placaUnica() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const t = Date.now() + 7919 * sequencia++;
  const letra = (i: number) => letras[Math.floor(t / 26 ** i / 7) % 26];
  return `X${letra(3)}${letra(2)}${t % 10}${letra(1)}${String(Math.floor(t / 10) % 100).padStart(2, '0')}`;
}

export async function cadastrarVeiculo(page: Page, v: { codigo: string; placa: string; quilometragem: number }) {
  await abrirMenu(page, 'Veículos');
  await page.getByRole('button', { name: 'Novo veículo' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel(/^Código interno/).fill(v.codigo);
  await form.getByLabel(/^Placa/).fill(v.placa);
  await form.getByLabel(/^Tipo/).click();
  await page.getByRole('option', { name: 'Hatch', exact: true }).click();
  await form.getByLabel(/^Marca/).fill('Fiat');
  await form.getByLabel(/^Modelo/).fill('Mobi Teste');
  await form.getByLabel(/^Unidade/).fill('Unidade de Testes');
  await form.getByLabel(/^Quilometragem atual/).fill(String(v.quilometragem));
  await form.getByRole('button', { name: 'Cadastrar veículo' }).click();
  await expect(page.getByText(`Veículo ${v.placa} cadastrado.`)).toBeVisible();
}

export async function cadastrarCondutor(page: Page, c: { nome: string; matricula: string }) {
  await abrirMenu(page, 'Condutores');
  await page.getByRole('button', { name: 'Novo condutor' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel(/^Nome completo/).fill(c.nome);
  await form.getByLabel(/^Matrícula/).fill(c.matricula);
  await form.getByLabel(/^Categoria da CNH/).click();
  await page.getByRole('option', { name: 'B', exact: true }).click();
  await form.getByLabel(/^Validade da CNH/).fill(new Date(Date.now() + 800 * 86_400_000).toISOString().slice(0, 10));
  await form.getByLabel('Liberado para utilizar veículos POOL').check();
  await form.getByRole('button', { name: 'Cadastrar condutor' }).click();
  await expect(page.getByText(`Condutor ${c.nome} cadastrado.`)).toBeVisible();
}

/** Inativa o veículo criado pelo teste (o histórico continua consultável). */
export async function inativarVeiculo(page: Page, placa: string, motivo = 'Veículo criado pelo teste automatizado.') {
  await abrirMenu(page, 'Veículos');
  await page.getByRole('button', { name: `Ações do veículo ${placa}` }).click();
  await page.getByRole('menuitem', { name: 'Inativar cadastro' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel(/^Motivo da inativação/).fill(motivo);
  await dialogo.getByRole('button', { name: 'Inativar veículo' }).click();
  await expect(page.getByText(`Veículo ${placa} inativado.`, { exact: false })).toBeVisible();
}

/** Inativa o condutor criado pelo teste, registrando o motivo. */
export async function inativarCondutor(page: Page, nome: string) {
  await abrirMenu(page, 'Condutores');
  await page.getByRole('button', { name: `Editar condutor ${nome}` }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Cadastro ativo').uncheck();
  await form.getByLabel(/^Motivo da inativação/).fill('Condutor criado pelo teste automatizado.');
  await form.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText(`Condutor ${nome} atualizado.`)).toBeVisible();
}
