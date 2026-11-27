# Frota Max Web

Aplicação Web administrativa do **Frota Max**, desenvolvida para o Departamento de Frotas da Araguaia S.A. no projeto extensionista da disciplina Programação Web Aplicada (UniEVANGÉLICA, 2026/2).

> **Estado atual:** Sprints 01 e 02 concluídas: autenticação, autorização por perfil, gestão de veículos, condutores e reservas/empréstimos com verificação de disponibilidade (API + interface), testados em ambiente local. Usa somente dados fictícios. Nenhum dado corporativo real nem credencial institucional deve ser adicionado a este repositório.

## Funcionalidades disponíveis

| Funcionalidade | Situação |
|---|---|
| Login e sessão (JWT), bloqueio após tentativas falhas | ✅ Sprint 01 |
| Perfis `admin`, `gestor_frota` e `visualizador`, com autorização no servidor | ✅ Sprint 01 |
| Veículos: indicadores, busca, filtros, cadastro, edição e alteração de situação | ✅ Sprint 01 |
| Condutores: cadastro, situação da CNH e liberação para o POOL | ✅ Sprint 02 |
| Reservas e empréstimos de veículos POOL com verificação de disponibilidade e de conflitos, retirada e cancelamento | ✅ Sprint 02 |
| Devolução, liberação da disponibilidade e histórico | ⏳ Sprint 03 |

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
| `frontend/src` | `pages/` (login, veículos, condutores, reservas), `components/` (layout, rota protegida, componentes de veículos, condutores e reservas), `contexts/` (sessão), `services/` (API) |
| `database/migrations` | Scripts SQL versionados da estrutura do banco |
| `docs/` | Auditoria da base recebida, perfis e permissões, registros de teste por sprint |

## Pré-requisitos

- Node.js 18 ou superior (com npm)
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

Os testes recriam o banco `frotamax_test` a cada execução e nunca usam o banco de desenvolvimento. O registro completo, com os testes de interface e as falhas corrigidas, está em `docs/sprint-01/TESTES_SPRINT_01.md` e `docs/sprint-02/TESTES_SPRINT_02.md`. As regras de reserva estão em `docs/sprint-02/REGRAS_RESERVAS.md`.

> Quem já tinha o banco da Sprint 01 só precisa rodar `npm run db:setup` de novo: a migration `002` cria as tabelas novas e o seed acrescenta condutores e reservas fictícios.

## Endpoints da API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/auth/me` | Autenticado |
| GET | `/api/veiculos?busca=&situacao=&tipo=&modalidade=` | Todos os perfis |
| GET | `/api/veiculos/resumo` | Todos os perfis |
| GET | `/api/veiculos/:id` | Todos os perfis |
| POST | `/api/veiculos` | admin, gestor_frota |
| PUT | `/api/veiculos/:id` | admin, gestor_frota |
| PATCH | `/api/veiculos/:id/situacao` | admin, gestor_frota |
| GET | `/api/condutores?busca=&situacao_cnh=&liberado_pool=&ativo=` | Todos os perfis |
| GET | `/api/condutores/resumo` | Todos os perfis |
| GET | `/api/condutores/:id` | Todos os perfis |
| POST | `/api/condutores` | admin, gestor_frota |
| PUT | `/api/condutores/:id` | admin, gestor_frota |
| GET | `/api/reservas?busca=&status=&tipo=&veiculo_id=&condutor_id=` | Todos os perfis |
| GET | `/api/reservas/resumo` | Todos os perfis |
| GET | `/api/reservas/disponibilidade?tipo=&inicio=&fim=` | Todos os perfis |
| GET | `/api/reservas/:id` (com histórico) | Todos os perfis |
| POST | `/api/reservas` | admin, gestor_frota |
| POST | `/api/reservas/:id/retirada` | admin, gestor_frota |
| POST | `/api/reservas/:id/cancelamento` | admin, gestor_frota |

## Segurança

- **Senhas:** armazenadas apenas como hash bcrypt.
- **Login:** a mensagem de erro é genérica e o acesso é bloqueado temporariamente após 5 tentativas falhas.
- **Autorização:** conferida no servidor em todas as rotas; a interface só esconde as ações não permitidas.
- **Validação:** toda entrada é validada no servidor e os campos não previstos são descartados.
- **Mensagens de erro:** não expõem consultas, stack trace nem dados internos.
- **Logs:** registram só método, rota, status e duração, sem corpo, tokens ou senhas.
- **Segredos:** ficam apenas no `.env` local, que é ignorado pelo Git.
