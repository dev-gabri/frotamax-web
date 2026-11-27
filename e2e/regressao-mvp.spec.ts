import { expect, Page, test } from '@playwright/test';
import {
  abrirMenu, cadastrarCondutor, cadastrarVeiculo, dataHoraLocal, entrar, inativarCondutor, inativarVeiculo,
  placaUnica, SENHA, sufixoUnico,
} from './apoio';

/**
 * Regressão do MVP no navegador (Sprint 04): login, tela inicial, veículos (com inativação),
 * reservas com conflito de período e cancelamento, perfil de consulta e retorno após o login.
 * Usa somente dados fictícios criados pelo próprio teste e inativados ao final.
 */
test.skip(!SENHA, 'Informe a senha dos usuários de demonstração em E2E_SENHA (a mesma de SEED_SENHA).');

const HORA = 3_600_000;

/** Lê o número de um cartão da tela inicial pelo rótulo acessível ("Título: N. Abrir a lista"). */
async function numeroDoCartao(page: Page, titulo: string) {
  const cartao = page.getByRole('button', { name: new RegExp(`^${titulo}: \\d+\\. Abrir a lista$`) });
  await expect(cartao).toBeVisible();
  return Number(((await cartao.getAttribute('aria-label')) ?? '').match(/: (\d+)\./)![1]);
}

test('E2E-03 — login: senha errada recebe mensagem genérica e o acesso correto abre a tela inicial', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('gestor@frotamax.local');
  await page.getByLabel('Senha', { exact: false }).first().fill('senha-errada-de-teste');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible();

  await entrar(page, 'gestor@frotamax.local');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
});

test('E2E-04 — tela inicial: os números coincidem com as listas que eles abrem', async ({ page }) => {
  await entrar(page, 'gestor@frotamax.local');
  const total = await numeroDoCartao(page, 'Total de veículos');
  await page.getByRole('button', { name: /^Total de veículos: / }).click();
  await expect(page).toHaveURL(/\/veiculos$/);
  await expect(page.getByText(`${total} veículo(s) exibido(s)`)).toBeVisible();

  await abrirMenu(page, 'Início');
  const manutencao = await numeroDoCartao(page, 'Em manutenção');
  await page.getByRole('button', { name: /^Em manutenção: / }).click();
  await expect(page).toHaveURL(/situacao=manutencao/);
  if (manutencao > 0) await expect(page.getByText(`${manutencao} veículo(s) exibido(s)`)).toBeVisible();
  else await expect(page.getByText('Nenhum veículo encontrado com os filtros informados.')).toBeVisible();

  await abrirMenu(page, 'Início');
  const atrasadas = await numeroDoCartao(page, 'Devoluções atrasadas');
  await page.getByRole('button', { name: /^Devoluções atrasadas: / }).click();
  await expect(page.getByText('Mostrando: Devoluções atrasadas')).toBeVisible();
  if (atrasadas > 0) await expect(page.getByText(`${atrasadas} registro(s) encontrado(s)`, { exact: false })).toBeVisible();
  else await expect(page.getByText('Nenhuma reserva encontrada com os filtros informados.')).toBeVisible();

  // O menu volta a lista ao padrão (sem o filtro que veio da tela inicial)
  await abrirMenu(page, 'Reservas e empréstimos');
  await expect(page.getByText('Mostrando: Devoluções atrasadas')).toHaveCount(0);

  await abrirMenu(page, 'Início');
  const condutores = await numeroDoCartao(page, 'Condutores ativos');
  await page.getByRole('button', { name: /^Condutores ativos: / }).click();
  await expect(page).toHaveURL(/\/condutores$/);
  await expect(page.getByText(`${condutores} condutor(es) exibido(s)`, { exact: false })).toBeVisible();
});

test('E2E-05 — veículo: validação da placa, cadastro, edição, inativação com motivo e reativação', async ({ page }) => {
  const sufixo = sufixoUnico();
  const placa = placaUnica();
  await entrar(page, 'gestor@frotamax.local');

  // Placa fora do padrão é recusada no próprio formulário
  await abrirMenu(page, 'Veículos');
  await page.getByRole('button', { name: 'Novo veículo' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel(/^Placa/).fill('AB-12');
  await form.getByRole('button', { name: 'Cadastrar veículo' }).click();
  await expect(form.getByText('Use o padrão ABC1234 ou ABC1D23.')).toBeVisible();
  await form.getByRole('button', { name: 'Cancelar' }).click();

  await cadastrarVeiculo(page, { codigo: `E2E-V${sufixo}`, placa, quilometragem: 5_000 });

  // Edição
  await page.getByRole('button', { name: `Ações do veículo ${placa}` }).click();
  await page.getByRole('menuitem', { name: 'Editar informações' }).click();
  await page.getByRole('dialog').getByLabel(/^Unidade/).fill('Unidade de Testes 2');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText(`Veículo ${placa} atualizado.`)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: placa })).toContainText('Unidade de Testes 2');

  // Inativação: o motivo é obrigatório
  await page.getByRole('button', { name: `Ações do veículo ${placa}` }).click();
  await page.getByRole('menuitem', { name: 'Inativar cadastro' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByRole('button', { name: 'Inativar veículo' }).click();
  await expect(dialogo.getByText('Descreva o motivo da inativação (mínimo de 5 caracteres).')).toBeVisible();
  await dialogo.getByLabel(/^Motivo da inativação/).fill('Veículo devolvido à locadora (teste).');
  await dialogo.getByRole('button', { name: 'Inativar veículo' }).click();
  await expect(page.getByText(`Veículo ${placa} inativado.`, { exact: false })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: placa })).toHaveCount(0);

  // Consulta dos inativos e reativação
  await page.getByRole('combobox', { name: 'Cadastro' }).click();
  await page.getByRole('option', { name: 'Inativos', exact: true }).click();
  const inativo = page.getByRole('row').filter({ hasText: placa });
  await expect(inativo.getByText('Inativo')).toBeVisible();
  await inativo.getByRole('button', { name: `Reativar o veículo ${placa}` }).click();
  await expect(page.getByText(`Veículo ${placa} reativado.`)).toBeVisible();
  await page.getByRole('combobox', { name: 'Cadastro' }).click();
  await page.getByRole('option', { name: 'Ativos', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: placa })).toBeVisible();

  await inativarVeiculo(page, placa);
});

test('E2E-06 — reserva: o veículo reservado não é oferecido em período conflitante e volta após o cancelamento', async ({ page }) => {
  const sufixo = sufixoUnico();
  const placa = placaUnica();
  const nome = `Condutora Reserva ${sufixo}`;
  await entrar(page, 'gestor@frotamax.local');
  await cadastrarVeiculo(page, { codigo: `E2E-R${sufixo}`, placa, quilometragem: 8_000 });
  await cadastrarCondutor(page, { nome, matricula: `E2E-R${sufixo}` });

  const inicio = new Date(Date.now() + 48 * HORA);
  inicio.setMinutes(0, 0, 0);
  const fim = new Date(inicio.getTime() + 3 * HORA);

  const abrirReserva = async (de: Date, ate: Date) => {
    await abrirMenu(page, 'Reservas e empréstimos');
    await page.getByRole('button', { name: 'Nova reserva ou empréstimo' }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel(/^Início \(retirada prevista\)/).fill(dataHoraLocal(de));
    await form.getByLabel(/^Previsão de devolução/).fill(dataHoraLocal(ate));
    await expect(form.getByText(/veículo\(s\) livre\(s\) no período/)).toBeVisible();
    return form;
  };

  // 1. Reserva do veículo para daqui a dois dias
  let form = await abrirReserva(inicio, fim);
  await form.getByLabel(/^Veículo POOL disponível/).click();
  await page.getByRole('option').filter({ hasText: placa }).click();
  await form.getByLabel(/^Condutor/).click();
  await page.getByRole('option', { name: new RegExp(nome) }).click();
  await form.getByLabel(/^Finalidade/).fill('Teste de conflito de período');
  await form.getByRole('button', { name: 'Registrar reserva' }).click();
  await expect(page.getByText(new RegExp(`Reserva nº \\d{4} registrada para ${placa}\\.`))).toBeVisible();

  // 2. Período que se sobrepõe: o veículo não aparece entre os livres
  form = await abrirReserva(new Date(inicio.getTime() + HORA), new Date(fim.getTime() + HORA));
  await form.getByLabel(/^Veículo POOL disponível/).click();
  await expect(page.getByRole('option').filter({ hasText: placa })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await form.getByRole('button', { name: 'Cancelar' }).click();

  // 3. Cancelamento com motivo libera o período
  const linha = page.getByRole('row').filter({ hasText: placa }).filter({ hasText: 'Agendada' });
  await linha.getByRole('button', { name: /^Cancelar reserva \d{4}$/ }).click();
  const cancelamento = page.getByRole('dialog');
  await cancelamento.getByLabel(/^Motivo do cancelamento/).fill('Viagem adiada (teste).');
  await cancelamento.getByRole('button', { name: 'Cancelar reserva' }).click();
  await expect(page.getByText(/Reserva nº \d{4} cancelada\./)).toBeVisible();

  form = await abrirReserva(new Date(inicio.getTime() + HORA), new Date(fim.getTime() + HORA));
  await form.getByLabel(/^Veículo POOL disponível/).click();
  await expect(page.getByRole('option').filter({ hasText: placa })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await form.getByRole('button', { name: 'Cancelar' }).click();

  await inativarVeiculo(page, placa);
  await inativarCondutor(page, nome);
});

test('E2E-07 — perfil de consulta: vê a tela inicial e as listas, sem ações de alteração', async ({ page }) => {
  await entrar(page, 'consulta@frotamax.local');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  await abrirMenu(page, 'Veículos');
  await expect(page.getByRole('table', { name: 'Lista de veículos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo veículo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Ações do veículo/ })).toHaveCount(0);
  await abrirMenu(page, 'Condutores');
  await expect(page.getByRole('button', { name: 'Novo condutor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Editar condutor/ })).toHaveCount(0);
  await abrirMenu(page, 'Reservas e empréstimos');
  await expect(page.getByRole('button', { name: 'Nova reserva ou empréstimo' })).toHaveCount(0);
});

test('E2E-08 — sessão: endereço protegido pede login e, depois dele, volta ao endereço com o filtro', async ({ page }) => {
  await page.goto('/reservas?prazo=atrasadas');
  await expect(page).toHaveURL(/\/login$/);
  await entrar(page, 'gestor@frotamax.local', false);
  await expect(page).toHaveURL(/\/reservas\?prazo=atrasadas$/);
  await expect(page.getByText('Mostrando: Devoluções atrasadas')).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
