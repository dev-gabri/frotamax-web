# Frota Max Web

Aplicação Web administrativa do **Frota Max**, desenvolvida para o Departamento de Frotas da Araguaia S.A. no projeto extensionista da disciplina Programação Web Aplicada (UniEVANGÉLICA, 2026/2).

> **Estado atual (versão 1.0.0, MVP):** Sprints 01 a 04 concluídas: autenticação, autorização por perfil, tela inicial com o resumo da frota, gestão de veículos (com inativação), condutores, reservas/empréstimos com verificação de disponibilidade, devolução e histórico de utilização (API + interface), com revisão de segurança, regressão completa e medição de desempenho em ambiente local. A validação com o Departamento de Frotas segue o roteiro e o formulário de `docs/sprint-04`; o resultado só é registrado depois da reunião. Usa somente dados fictícios. Nenhum dado corporativo real nem credencial institucional deve ser adicionado a este repositório.

## Funcionalidades disponíveis

| Funcionalidade | Situação |
|---|---|
| Login e sessão (JWT), bloqueio após tentativas falhas | ✅ Sprint 01 |
| Perfis `admin`, `gestor_frota` e `visualizador`, com autorização no servidor | ✅ Sprint 01 |
| Veículos: indicadores, busca, filtros, cadastro, edição e alteração de situação | ✅ Sprint 01 |
| Condutores: cadastro, situação da CNH e liberação para o POOL | ✅ Sprint 02 |
| Reservas e empréstimos de veículos POOL com verificação de disponibilidade e de conflitos, retirada e cancelamento | ✅ Sprint 02 |
| Devolução com quilometragem e observação, envio para manutenção e liberação da disponibilidade | ✅ Sprint 03 |
| Histórico de utilização por veículo e por condutor; consulta de movimentações por período, com paginação | ✅ Sprint 03 |
| Tela inicial com os números da frota, devoluções atrasadas e retiradas de hoje; cada número abre a lista filtrada | ✅ Sprint 04 |
| Inativação e reativação de veículos e condutores com data, responsável e motivo, preservando o histórico | ✅ Sprint 04 |
| Revisão de segurança, dependências sem vulnerabilidades conhecidas, regressão e responsividade testadas | ✅ Sprint 04 |

## Arquitetura

```
Navegador ──► Front-end (React + Vite + MUI, porta 3000)
                  │  HTTP/JSON (Axios) com token JWT
                  ▼
              API REST (Node.js + Express + TypeScript, porta 3001)
                  │  autenticação, autorização, validação (Joi) e regras
                  ▼
              PostgreSQL local (acesso exclusivo do back-end)
```

| Pasta | Conteúdo |
|---|---|
| `backend/src` | `app.ts` (montagem da API), `routes/` (auth, veiculos, condutores, reservas), `middleware/` (autenticação, autorização, validação, erros, logs), `db/` (conexão, migrations, seed), `config/` (ambiente e permissões) |
| `backend/tests` | Testes automatizados da API (Jest + Supertest) |
| `backend/scripts` | Medição de desempenho das consultas com volume de teste |
| `frontend/src` | `pages/` (login, início, veículos, condutores, reservas), `components/` (layout, rota protegida, componentes de veículos, condutores e reservas), `contexts/` (sessão), `hooks/` (filtros pela URL), `services/` (API) |
| `e2e` | Testes de navegador (Playwright): ciclo de movimentação, regressão do MVP e responsividade |
| `database/migrations` | Scripts SQL versionados da estrutura do banco |
| `docs/` | Auditoria da base recebida, perfis e permissões, registros de teste por sprint |

## Pré-requisitos

- Node.js 20 ou superior (com npm)
- PostgreSQL 14 ou superior, rodando localmente

## Execução local

1. **Criar o usuário e os bancos no PostgreSQL** (uma única vez), por exemplo pelo `psql` ou pelo pgAdmin:
   ```sql
   CREATE ROLE frotamax LOGIN PASSWORD 'frotamax' CREATEDB;
   CREATE DATABASE frotamax OWNER frotamax;
   CREATE DATABASE frotamax_test OWNER frotamax;
   ```
2. **Configurar as variáveis de ambiente:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Em `backend/.env`, defina:
   - `JWT_SECRET`: um segredo próprio com pelo menos 32 caracteres;
   - `SEED_SENHA`: a senha dos usuários fictícios de demonstração.
3. **Instalar as dependências:**
   ```bash
   npm run install:all
   ```
4. **Criar as tabelas e carregar os dados fictícios:**
   ```bash
   npm run db:setup
   ```
5. **Executar a API e a interface:**
   ```bash
   npm run dev
   ```
   - Interface: http://localhost:3000
   - API: http://localhost:3001/api/health

Para voltar a um estado conhecido antes de uma demonstração (apaga os registros do banco **local** e carrega de novo os dados fictícios):

```bash
npm run db:recriar -- --confirmar
```

### Usuários de demonstração (fictícios)

| E-mail | Perfil |
|---|---|
| `admin@frotamax.local` | Administrador |
| `gestor@frotamax.local` | Gestor de Frota |
| `consulta@frotamax.local` | Consulta |

A senha é a definida em `SEED_SENHA` no seu `backend/.env`.

## Testes

```bash
npm --prefix backend test
```

Os testes recriam o banco `frotamax_test` a cada execução e nunca usam o banco de desenvolvimento. O registro completo, com os testes de interface e as falhas corrigidas, está em `docs/sprint-01/TESTES_SPRINT_01.md` a `docs/sprint-04/TESTES_SPRINT_04.md`. As regras de reserva estão em `docs/sprint-02/REGRAS_RESERVAS.md`, as de devolução em `docs/sprint-03/REGRAS_DEVOLUCAO.md` e a revisão de segurança em `docs/sprint-04/REVISAO_SEGURANCA.md`.

### Testes de navegador (Sprints 03 e 04)

Com o sistema em execução (`npm run dev`), em outro terminal:

```bash
# Windows (PowerShell): $env:E2E_SENHA="<a mesma senha de SEED_SENHA>"; npm run test:e2e
E2E_SENHA="<a mesma senha de SEED_SENHA>" npm run test:e2e
```

Os testes usam o navegador já instalado (Microsoft Edge no Windows, Google Chrome nos demais sistemas; para trocar, defina `E2E_NAVEGADOR=chrome` ou `msedge`). Eles criam veículos e condutores fictícios próprios no banco de desenvolvimento e os inativam ao final, sem alterar os dados de demonstração.

| Arquivo | Conteúdo |
|---|---|
| `e2e/fluxo-movimentacao.spec.ts` | Cadastro de condutor e veículo → empréstimo → devolução → histórico; perfil de consulta |
| `e2e/regressao-mvp.spec.ts` | Login, tela inicial, veículo (com inativação), conflito de reserva e cancelamento, perfil de consulta, retorno após o login |
| `e2e/responsividade.spec.ts` | Quatro larguras de tela sem rolagem horizontal e login pelo teclado |

### Desempenho das consultas (Sprint 04)

```bash
npm --prefix backend run medir:desempenho
```

Recria o banco **de testes** com 500 veículos, 1.000 condutores e 30.000 movimentações fictícias e mostra a mediana e o tempo de 95% das requisições de cada consulta. O resultado registrado está em `docs/sprint-04/TESTES_SPRINT_04.md`.

> Quem já tinha o banco de uma sprint anterior só precisa rodar `npm run db:setup` de novo: as migrations novas (até a `004`) são aplicadas e o seed acrescenta os dados fictícios que faltam.

## Endpoints da API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/veiculos?busca=&situacao=&tipo=&modalidade=&ativo=` | Todos os perfis |
| GET | `/api/veiculos/resumo` | Todos os perfis |
| GET | `/api/veiculos/:id` | Todos os perfis |
| POST | `/api/veiculos` | admin, gestor_frota |
| PUT | `/api/veiculos/:id` | admin, gestor_frota |
| PATCH | `/api/veiculos/:id/situacao` | admin, gestor_frota |
| PATCH | `/api/veiculos/:id/inativacao` (motivo obrigatório) | admin, gestor_frota |
| PATCH | `/api/veiculos/:id/reativacao` | admin, gestor_frota |
| GET | `/api/condutores?busca=&situacao_cnh=&liberado_pool=&ativo=` | Todos os perfis |
| GET | `/api/condutores/resumo` | Todos os perfis |
| GET | `/api/condutores/:id` | Todos os perfis |
| POST | `/api/condutores` | admin, gestor_frota |
| PUT | `/api/condutores/:id` (inclui inativação com motivo opcional) | admin, gestor_frota |
| GET | `/api/veiculos/:id/historico?pagina=&por_pagina=` | Todos os perfis |
| GET | `/api/condutores/:id/historico?pagina=&por_pagina=` | Todos os perfis |
| GET | `/api/reservas?busca=&status=&tipo=&veiculo_id=&condutor_id=&de=&ate=&prazo=&pagina=&por_pagina=` | Todos os perfis |
| GET | `/api/reservas/resumo` | Todos os perfis |
| GET | `/api/reservas/disponibilidade?tipo=&inicio=&fim=` | Todos os perfis |
| GET | `/api/reservas/:id` (com histórico) | Todos os perfis |
| POST | `/api/reservas` | admin, gestor_frota |
| POST | `/api/reservas/:id/retirada` | admin, gestor_frota |
| POST | `/api/reservas/:id/cancelamento` | admin, gestor_frota |
| POST | `/api/reservas/:id/devolucao` | admin, gestor_frota |

## Segurança

- **Senhas:** armazenadas apenas como hash bcrypt.
- **Login:** a mensagem de erro é genérica; o acesso é bloqueado por 15 minutos após 5 falhas do mesmo e-mail ou 20 falhas da mesma origem.
- **Autorização:** conferida no servidor em todas as rotas; a interface só esconde as ações não permitidas.
- **Validação:** toda entrada é validada no servidor e os campos não previstos são descartados.
- **Mensagens de erro:** não expõem consultas, stack trace nem dados internos.
- **Logs:** registram só método, rota, status e duração, sem corpo, tokens ou senhas.
- **Segredos:** ficam apenas no `.env` local, que é ignorado pelo Git; o histórico do repositório foi verificado na Sprint 04.
- **Histórico:** o banco recusa excluir cadastros, movimentações e eventos; registros fora de uso são inativados.
- **Dependências:** `npm audit` sem vulnerabilidades conhecidas na raiz, no backend e no frontend (27/11/2026).

Os pontos que dependem do ambiente corporativo (HTTPS, servidor de produção, gestão de usuários e backup) estão em `docs/sprint-04/REVISAO_SEGURANCA.md`.

## Limitações e evolução futura

- Fora do MVP: registro avulso de quilometragem, manutenção preventiva e corretiva, checklist, veículo de uso atribuído com vínculo ao colaborador, integrações com RST e Ticket Log e o aplicativo Mobile. Esses itens continuam no Product Backlog.
- Não há tela de usuários nem troca de senha; a forma de acesso dos usuários reais depende da Gestão de TI.
- Os testes de navegador rodam no navegador instalado (Google Chrome ou Microsoft Edge) e em larguras de tela simuladas; Firefox, Safari e aparelhos celulares reais não foram testados.
