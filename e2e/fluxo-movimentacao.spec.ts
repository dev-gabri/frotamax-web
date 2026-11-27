import { expect, Page, test } from '@playwright/test';

/**
 * Roteiro de navegador automatizado (ação da retrospectiva da Sprint 02):
 * cadastro de condutor → empréstimo → devolução → histórico do veículo e do condutor.
 * Usa somente dados fictícios; cada execução cria um condutor novo com matrícula única.
 * A senha é a mesma de SEED_SENHA (backend/.env), informada em E2E_SENHA.
 */
const SENHA = process.env.E2E_SENHA;
test.skip(!SENHA, 'Informe a senha dos usuários de demonstração em E2E_SENHA (a mesma de SEED_SENHA).');

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: false }).first().fill(SENHA!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

/** Navega pelo menu principal (a tela inicial também tem botões com os mesmos nomes). */
async function abrirMenu(page: Page, item: string) {
  await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: item, exact: true }).click();
}

const formato = new Intl.NumberFormat('pt-BR');
const dataHoraLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

test('ciclo completo: condutor, empréstimo, devolução e histórico', async ({ page }) => {
  const sufixo = Date.now().toString().slice(-6);
  const nome = `Condutor Teste ${sufixo}`;
  const matricula = `E2E-${sufixo}`;
  await entrar(page, 'gestor@frotamax.local');

  // 1. Cadastro de condutor liberado para o POOL
  await abrirMenu(page, 'Condutores');
  await page.getByRole('button', { name: 'Novo condutor' }).click();
  const formCondutor = page.getByRole('dialog');
  await formCondutor.getByLabel(/^Nome completo/).fill(nome);
  await formCondutor.getByLabel(/^Matrícula/).fill(matricula);
  await formCondutor.getByLabel(/^Categoria da CNH/).click();
  await page.getByRole('option', { name: 'B', exact: true }).click();
  const validade = new Date(Date.now() + 800 * 86_400_000);
  await formCondutor.getByLabel(/^Validade da CNH/).fill(validade.toISOString().slice(0, 10));
  await formCondutor.getByLabel('Liberado para utilizar veículos POOL').check();
  await formCondutor.getByRole('button', { name: 'Cadastrar condutor' }).click();
  await expect(page.getByText(`Condutor ${nome} cadastrado.`)).toBeVisible();

  // 2. Empréstimo (retirada imediata) do primeiro veículo POOL disponível
  await abrirMenu(page, 'Reservas e empréstimos');
  await page.getByRole('button', { name: 'Nova reserva ou empréstimo' }).click();
  const formReserva = page.getByRole('dialog');
  await formReserva.getByRole('button', { name: /Empréstimo/ }).click();
  await formReserva.getByLabel(/^Previsão de devolução/).fill(dataHoraLocal(new Date(Date.now() + 3 * 3_600_000)));
  await formReserva.getByLabel(/^Veículo POOL disponível/).click();
  const opcao = page.getByRole('option').filter({ hasText: /[A-Z]{3}\d[A-Z0-9]\d{2}/ }).first();
  const placa = ((await opcao.innerText()).match(/[A-Z]{3}\d[A-Z0-9]\d{2}/) || [''])[0];
  await opcao.click();
  await formReserva.getByLabel(/^Condutor/).click();
  await page.getByRole('option', { name: new RegExp(nome) }).click();
  await formReserva.getByLabel(/^Finalidade/).fill('Teste automatizado de navegador');
  await formReserva.getByRole('button', { name: 'Registrar empréstimo' }).click();
  await expect(page.getByText(new RegExp(`Empréstimo nº \\d{4} registrado\\. ${placa} está em uso\\.`))).toBeVisible();

  // 3. Devolução: quilometragem menor é recusada; a correta encerra o empréstimo
  const linha = page.getByRole('row').filter({ hasText: placa }).filter({ hasText: nome });
  await linha.getByRole('button', { name: 'Devolução' }).click();
  const formDevolucao = page.getByRole('dialog');
  const ajuda = await formDevolucao.getByText(/^Na retirada: /).innerText();
  const kmRetirada = Number(ajuda.replace(/\D/g, ''));
  await formDevolucao.getByLabel(/^Quilometragem de chegada/).fill(String(kmRetirada - 1));
  await formDevolucao.getByRole('button', { name: 'Registrar devolução' }).click();
  await expect(formDevolucao.getByText(/não pode ser menor que a registrada/)).toBeVisible();
  await formDevolucao.getByLabel(/^Quilometragem de chegada/).fill(String(kmRetirada + 42));
  await expect(formDevolucao.getByText(/não pode ser menor que a registrada/)).toHaveCount(0);
  await expect(formDevolucao.getByText('Percorridos nesta utilização: 42 km')).toBeVisible();
  await formDevolucao.getByLabel(/^Observação/).fill('Sem ocorrências.');
  await formDevolucao.getByRole('button', { name: 'Registrar devolução' }).click();
  await expect(page.getByText(`Devolução registrada. ${placa} está disponível.`)).toBeVisible();
  await expect(linha.getByText(/Devolvido em/)).toBeVisible();

  // 4. Histórico do veículo mostra a utilização com a quilometragem percorrida
  await abrirMenu(page, 'Veículos');
  await page.getByRole('button', { name: `Histórico de utilização do veículo ${placa}` }).click();
  const historico = page.getByRole('dialog');
  const movimento = historico.getByRole('row').filter({ hasText: nome });
  await expect(movimento).toContainText('42 km');
  await expect(movimento).toContainText('Concluída');
  await expect(historico.getByText(`Quilometragem atual: ${formato.format(kmRetirada + 42)} km`, { exact: false })).toBeVisible();
  await historico.getByRole('button', { name: 'Fechar' }).click();

  // 5. Histórico do condutor
  await abrirMenu(page, 'Condutores');
  await page.getByRole('button', { name: `Histórico de utilização do condutor ${nome}` }).click();
  await expect(page.getByRole('dialog').getByRole('row').filter({ hasText: placa })).toContainText('42 km');
});

test('perfil de consulta vê o histórico, mas não registra devolução', async ({ page }) => {
  await entrar(page, 'consulta@frotamax.local');
  await abrirMenu(page, 'Reservas e empréstimos');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Devolução' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nova reserva ou empréstimo' })).toHaveCount(0);
  await abrirMenu(page, 'Veículos');
  await page.getByRole('button', { name: /^Histórico de utilização do veículo/ }).first().click();
  await expect(page.getByRole('dialog').getByText('Movimentações')).toBeVisible();
});
