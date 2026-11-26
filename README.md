# Frota Max Web

Aplicação Web administrativa do **Frota Max**, desenvolvida para o Departamento de Frotas da Araguaia S.A. no projeto extensionista da disciplina Programação Web Aplicada (UniEVANGÉLICA, 2026/2).

> **Estado atual:** em desenvolvimento (Sprint 01). Usa somente dados fictícios em ambiente local. Nenhum dado corporativo real nem credencial institucional deve ser adicionado a este repositório.

## Arquitetura

```
Navegador ──► Front-end (React + Vite + MUI, porta 3000)
                  │  HTTP/JSON (Axios)
                  ▼
              API REST (Node.js + Express + TypeScript, porta 3001)
                  │  autenticação, autorização, validação e regras
                  ▼
              PostgreSQL local (acesso exclusivo do back-end)
```

| Pasta | Conteúdo |
|---|---|
| `backend/` | API REST (`src/app.ts`, rotas, middlewares, acesso ao banco em `src/db`) |
| `frontend/` | Interface Web (páginas, componentes, contexto de autenticação, serviços HTTP) |
| `database/migrations/` | Scripts SQL versionados que criam a estrutura do banco |
| `docs/` | Auditoria da base recebida e referências |

## Pré-requisitos

- Node.js 18 ou superior (com npm)
- PostgreSQL 14 ou superior, rodando localmente

## Execução local

1. **Criar o usuário e os bancos no PostgreSQL** (uma única vez):
   ```sql
   CREATE ROLE frotamax LOGIN PASSWORD 'frotamax' CREATEDB;
   CREATE DATABASE frotamax OWNER frotamax;
   CREATE DATABASE frotamax_test OWNER frotamax;
   ```
2. **Configurar as variáveis de ambiente:**
   ```bash
   cp backend/.env.example backend/.env
   # edite backend/.env e defina um JWT_SECRET próprio (mínimo de 32 caracteres)
   ```
3. **Instalar as dependências:**
   ```bash
   npm run install:all
   ```
4. **Executar a API e a interface:**
   ```bash
   npm run dev
   ```
   - API: http://localhost:3001/api/health
   - Interface: http://localhost:3000
