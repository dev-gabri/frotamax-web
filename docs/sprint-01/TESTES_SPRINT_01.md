# Sprint 01 — Registro de testes

Incremento testado: ambiente local, autenticação, autorização e gestão de veículos (API + interface Web).
Todos os testes usaram somente dados fictícios em ambiente local (PostgreSQL 16, Node.js 22, Google Chrome).

## 1. Testes automatizados da API (Jest + Supertest)

Comando: `npm --prefix backend test`. O banco de testes (`frotamax_test`) é recriado a cada execução.

| ID | Cenário | Requisito / critério | Resultado |
|---|---|---|---|
| CT01 | Login válido retorna token e dados do usuário, sem a senha | RNF04, CA13 | Aprovado |
| CT02 | E-mail aceito sem diferenciar maiúsculas | RNF01 | Aprovado |
| CT03 | Senha incorreta rejeitada com mensagem genérica | RNF04, RNF08 | Aprovado |
| CT04 | E-mail inexistente recebe a mesma mensagem (não revela contas) | RNF05, CA14 | Aprovado |
| CT05 | Campos vazios ou inválidos rejeitados com orientação | RNF07, CA15 | Aprovado |
| CT06 | Usuário inativo não autentica | RNF04 | Aprovado |
| CT07 | Rota protegida recusa acesso sem token e com token inválido ou adulterado | RNF04, CA13 | Aprovado |
| CT08 | Sessão válida retorna o usuário atual | RNF04 | Aprovado |
| CT09 | Bloqueio temporário após 5 tentativas falhas | RNF05 | Aprovado |
| CT10 | Perfil de consulta lista veículos | RF02 | Aprovado |
| CT11 | Perfil de consulta não cadastra, não edita e não altera situação (403) | RNF05, CA13 | Aprovado |
| CT12 | API de veículos exige autenticação | RNF04 | Aprovado |
| CT13 | Cadastro de veículo; placa e código normalizados | RF01, CA01 | Aprovado |
| CT14 | Registro persistido e recuperado em nova consulta | RF02, CA01 | Aprovado |
| CT15 | Dados obrigatórios ausentes ou inválidos rejeitados (400) | RNF07, CA15 | Aprovado |
| CT16 | Placa ou código duplicados rejeitados (409) | RNF09, CA15 | Aprovado |
| CT17 | Atualização aplicada e persistida; campos não previstos descartados | RF03, CA01 | Aprovado |
| CT18 | Quilometragem menor que a registrada rejeitada (422) | RNF09 | Aprovado |
| CT19 | Alteração de situação atualiza os indicadores | RF04, CA02 | Aprovado |
| CT20 | Situação inexistente rejeitada (400) | RNF07 | Aprovado |
| CT21 | Busca e filtros retornam somente os veículos correspondentes | RF13, CA09 | Aprovado |
| CT22 | Identificador inválido (400) e veículo inexistente (404) | RNF08 | Aprovado |
| CT23 | Erros não expõem detalhes internos | RNF08, CA14 | Aprovado |
| CT24 | Health check confirma API e banco disponíveis | RNF11 | Aprovado |

Resultado da última execução: **24 aprovados de 24**.

## 2. Teste do fluxo na interface (navegador)

Roteiro executado no Google Chrome, com a API e o front-end em execução local.

| ID | Passo | Resultado esperado | Resultado |
|---|---|---|---|
| TF01 | Acessar `/veiculos` sem sessão | Redireciona para o login | Aprovado |
| TF02 | Enviar o login com os campos vazios | Mensagens por campo, sem chamar a API | Aprovado |
| TF03 | Login com senha incorreta | "E-mail ou senha inválidos." e senha apagada | Aprovado |
| TF04 | Login do gestor | Abre a gestão de veículos com indicadores e lista | Aprovado |
| TF05 | Cadastrar com campos obrigatórios vazios e placa inválida | Mensagens de validação em cada campo | **Reprovado → BUG-01 → corrigido e aprovado no reteste** |
| TF06 | Cadastrar um veículo válido (placa digitada como `jkl-9m12`) | Cadastro salvo como `JKL9M12`, aviso de sucesso e indicadores atualizados | Aprovado |
| TF07 | Cadastrar com placa já existente | Mensagem da API "Já existe um veículo cadastrado com esta placa." | Aprovado |
| TF08 | Editar informando quilometragem menor que a atual | Bloqueio com a quilometragem registrada | Aprovado |
| TF09 | Editar unidade e quilometragem | Alteração salva | Aprovado |
| TF10 | Alterar a situação para "Em manutenção" | Situação e indicadores atualizados | Aprovado |
| TF11 | Filtrar por situação e buscar por marca | Lista restrita aos veículos correspondentes | Aprovado |
| TF12 | Recarregar a página (F5) | Sessão e dados mantidos (persistência) | Aprovado |
| TF13 | Tela de 390 px (celular) e 820 px (tablet) | Menu recolhido, indicadores em 2 colunas, filtros empilhados e lista em cartões | **Ajuste → BUG-02 → corrigido e aprovado no reteste** |
| TF14 | Sair e entrar como perfil de consulta | Sem os botões de cadastro e edição | Aprovado |

## 3. Falhas encontradas e corrigidas

| ID | Falha | Causa | Correção | Reteste |
|---|---|---|---|---|
| BUG-01 | A mensagem de erro da placa inválida não aparecia no formulário de cadastro | O texto de ajuda do campo ("Ex.: ABC1D23") sobrescrevia a mensagem de validação | Ordem das propriedades do campo corrigida (commit `fix(web)`) | Aprovado |
| BUG-02 | Em telas pequenas, a quilometragem quebrava a linha entre o número e "km" | Espaço comum entre o valor e a unidade | Espaço não separável e botão "Limpar filtros" com texto em telas pequenas | Aprovado |
