# Auditoria da base técnica recebida

Esta auditoria registra o conteúdo da base Web recebida e incorporada ao repositório no commit inicial (`217ad08`, "Estrutura inicial do Frota Max Web"). Ela também define o que foi aproveitado, adaptado ou retirado na Sprint 01. A auditoria foi feita só com leitura do código, antes de qualquer alteração.

## Conteúdo da base

| Diretório / arquivo | Conteúdo | Finalidade original |
|---|---|---|
| `package.json` (raiz) | Scripts `dev`, `build` e `install:all` com `concurrently` | Executar front-end e back-end juntos |
| `backend/` | API em Node.js + Express + TypeScript: 13 grupos de rotas (auth, users, employees, drivers, vehicles, reservations, documents, notifications, reports, dashboard, settings, import, assignments), middlewares de autenticação, upload e erros, serviços e tipos | API completa de gestão de frota |
| `frontend/` | React 18 + Vite + Material UI: 13 páginas (login, primeiro acesso, dashboard, veículos, condutores, reservas, colaboradores, relatórios, perfil, configurações, usuários, importação, atribuições), layout, contexto de autenticação e tema, serviços HTTP | Interface administrativa |
| `database/schema.sql` | 9 tabelas (users, user_profiles, employees, drivers, vehicles, reservations, documents, notifications, audit_log), políticas RLS, triggers | Banco no Supabase |
| `database/migrations/` | 3 scripts incrementais (atribuições de veículos, campos de tema, remoção de campo de CNH) | Evolução do banco |
| `README.md`, `GITHUB_SETUP.md` | Instruções genéricas de instalação e publicação | Documentação |

Tamanho aproximado: 17 mil linhas de TypeScript/TSX e SQL.

## Achados

| # | Achado | Impacto | Decisão na Sprint 01 |
|---|---|---|---|
| A1 | Todo o acesso a dados usa o cliente do Supabase com a chave `service_role` (schema `log_frotamax`), que ignora as políticas RLS | Exige um projeto Supabase externo, possivelmente corporativo, sem autorização confirmada; toda a segurança fica a cargo da API | Acesso a dados refeito com PostgreSQL local (`pg`), sem dependência de serviço externo |
| A2 | `POST /api/auth/register` é público e aceita qualquer perfil, inclusive `admin` | Qualquer pessoa poderia criar um administrador | Rota removida; usuários iniciais criados só pelo seed com dados fictícios |
| A3 | `GET /api/assignments/test-no-auth` consulta o banco sem autenticação | Exposição de dados | Rota retirada da base ativa |
| A4 | Token de redefinição de senha e dados de login são escritos no console | Vazamento de credenciais em logs | Fluxo retirado; logs passam a registrar só método, rota, status e tempo |
| A5 | Importação CSV exige apenas autenticação, sem verificar perfil | Qualquer usuário autenticado poderia importar dados | Módulo fora do escopo da Sprint 01; retirado da base ativa |
| A6 | `/uploads` é servido estaticamente, sem autenticação | Documentos acessíveis por URL | Retirado da base ativa |
| A7 | O código consulta colunas que não existem em `schema.sql` (`account_status`, `first_login_required`, `failed_login_attempts`, `locked_until`) | Banco não reproduzível a partir do repositório | Nova estrutura versionada em migrations numeradas |
| A8 | Jest está configurado, mas não existe nenhum teste | Nada comprova o funcionamento | Testes automatizados da API criados na Sprint 01 |
| A9 | O escopo vai muito além do MVP (documentos, notificações agendadas, importação, colaboradores, atribuições, relatórios, tema) | Risco de desviar o foco do núcleo do MVP | Só autenticação e veículos permanecem ativos; os demais módulos continuam no histórico do Git como referência |

## O que foi aproveitado

- **Stack e estrutura:** Express + TypeScript, React + Vite + MUI, organização `backend/`, `frontend/`, `database/`.
- **Padrões:** resposta `{ success, data, error }`, middleware de erro, `helmet`, `cors`, `bcryptjs` para senhas, `jsonwebtoken`, `joi` para validação.
- **Front-end:** `AuthContext`, `ProtectedRoute`, interceptador do Axios, `Layout` com menu lateral responsivo, logotipo e tema MUI, todos adaptados.
- **Modelo de dados:** perfis `admin`, `gestor_frota` e `visualizador` e situações do veículo (`disponivel`, `em_uso`, `manutencao`, `indisponivel`).

## O que foi retirado da base ativa

Rotas, páginas e serviços de condutores, reservas, documentos, notificações, relatórios, dashboard, configurações, importação, colaboradores, atribuições e perfil. Também saíram o cliente Supabase, o upload de arquivos e a tarefa agendada (`node-cron`). Tudo continua disponível no commit inicial para consulta. Condutores e reservas serão reimplementados sobre o PostgreSQL local nas Sprints 02 e 03, conforme o planejamento.
