import { expect, test } from '@playwright/test';
import {
  abrirMenu, cadastrarCondutor, cadastrarVeiculo, dataHoraLocal, entrar, inativarCondutor, inativarVeiculo,
  placaUnica, SENHA, sufixoUnico,
} from './apoio';

/**
 * Roteiro de navegador automatizado (ação da retrospectiva da Sprint 02):
 * cadastro de condutor → empréstimo → devolução → histórico do veículo e do condutor.
 * Usa somente dados fictícios. Desde a Sprint 04, o teste cria o próprio veículo e o inativa
 * ao final, junto com o condutor, para não alterar os dados de demonstração.
 * A senha é a mesma de SEED_SENHA (backend/.env), informada em E2E_SENHA.
 */
test.skip(!SENHA, 'Informe a senha dos usuários de demonstração em E2E_SENHA (a mesma de SEED_SENHA).');

const formato = new Intl.NumberFormat('pt-BR');

test('ciclo completo: condutor, empréstimo, devolução e histórico', async ({ page }) => {
  const sufixo = sufixoUnico();
  const nome = `Condutor Teste ${sufixo}`;
  const placa = placaUnica();
  const kmRetirada = 12_000;
  await entrar(page, 'gestor@frotamax.local');

  // 1. Cadastros: condutor liberado para o POOL e veículo POOL disponível
  await cadastrarCondutor(page, { nome, matricula: `E2E-${sufixo}` });
  await cadastrarVeiculo(page, { codigo: `E2E-V${sufixo}`, placa, quilometragem: kmRetirada });

  // 2. Empréstimo (retirada imediata) do veículo cadastrado
  await abrirMenu(page, 'Reservas e empréstimos');
  await page.getByRole('button', { name: 'Nova reserva ou empréstimo' }).click();
  const formReserva = page.getByRole('dialog');
  await formReserva.getByRole('button', { name: /Empréstimo/ }).click();
  await formReserva.getByLabel(/^Previsão de devolução/).fill(dataHoraLocal(new Date(Date.now() + 3 * 3_600_000)));
  await formReserva.getByLabel(/^Veículo POOL disponível/).click();
  await page.getByRole('option').filter({ hasText: placa }).click();
  await formReserva.getByLabel(/^Condutor/).click();
  await page.getByRole('option', { name: new RegExp(nome) }).click();
  await formReserva.getByLabel(/^Finalidade/).fill('Teste automatizado de navegador');
  await formReserva.getByRole('button', { name: 'Registrar empréstimo' }).click();
  await expect(page.getByText(new RegExp(`Empréstimo nº \\d{4} registrado\\. ${placa} está em uso\\.`))).toBeVisible();

  // 3. Devolução: quilometragem menor é recusada; a correta encerra o empréstimo
  const linha = page.getByRole('row').filter({ hasText: placa }).filter({ hasText: nome });
  await linha.getByRole('button', { name: 'Devolução' }).click();
  const formDevolucao = page.getByRole('dialog');
  await expect(formDevolucao.getByText(/^Na retirada: /)).toContainText(formato.format(kmRetirada));
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
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();

  // 6. Limpeza: veículo e condutor do teste são inativados (o histórico permanece)
  await inativarVeiculo(page, placa);
  await inativarCondutor(page, nome);
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
