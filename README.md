# Frota Max Web

Projeto de **Programação Web Aplicada**, com entrega acadêmica independente do aplicativo Mobile. Gabriel Pedro Neto França · ADS · UniEVANGÉLICA · 2026/2.

## Objetivo e escopo preliminar

Apoiar a gestão administrativa do Departamento de Frotas: veículos, condutores, reservas, manutenção, históricos e indicadores, conforme priorização e validação do MVP. As possibilidades levantadas não representam funcionalidades aprovadas ou prontas.

**Estado atual: base técnica recebida, ainda não homologada.** A importação inicial para o Git registra a base existente e a organização atual. Não comprova desenvolvimento nas sprints acadêmicas, execução bem-sucedida ou aceite institucional.

## Estrutura

- `frontend/`: aplicação de referência React/TypeScript.
- `backend/`: API de referência Node.js/Express/TypeScript.
- `database/`: esquema e migrações de referência Supabase/PostgreSQL.
- `docs/fase-1/`: backlog Web, auditoria e mapeamento acadêmico.
- `docs/entregas/`: orientação para evidências e entregas Web.
- `.github/`: modelos de issue e pull request.

## Execução da base recebida

```bash
npm install
npm run install:all
npm run dev
```

Esses comandos vêm da organização existente e ainda precisam de validação em ambiente limpo. Usar os arquivos `.env.example` para preparar configurações locais, com dados fictícios. A organização do GitHub não homologou build, testes ou implantação.

## Integração com Mobile

A API e o banco ficam neste repositório. O [Frota Max Mobile](https://github.com/dev-gabri/frotamax-mobile) terá código próprio e consumirá um contrato comum ainda a definir. Corrigir os pontos da [auditoria técnica](docs/fase-1/AUDITORIA_TECNICA_INICIAL.md) antes de integrar dados reais.

[Índice dos dois projetos](https://github.com/dev-gabri/frotamax) · [Backlog Web](docs/fase-1/BACKLOG_WEB.md) · [Issues Web](https://github.com/dev-gabri/frotamax-web/issues)

Relatório, planejamento e evidências Web são independentes de Mobile. Relatórios anteriores permanecem localmente, fora do Git, para revisão e atualização.

## Privacidade

Repositório privado. Não versionar credenciais, planilhas corporativas, entrevistas, uploads ou dados pessoais. Integrações externas dependem de autorização e validação técnica. A base possui pendências conhecidas de autorização, logs e arquivos e não deve ser usada com dados reais antes das correções.
