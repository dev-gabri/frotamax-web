# Sprint 04 — Registro de testes

Incremento testado: revisão de segurança, integridade e inativação de cadastros, tela inicial com o resumo da frota, regressão completa do MVP, responsividade e desempenho das consultas. Todos os testes usaram somente dados fictícios em ambiente local (PostgreSQL 16, Node.js 22, Google Chrome).

## 1. Testes automatizados da API (Jest + Supertest)

Comando: `npm --prefix backend test`. O banco de testes (`frotamax_test`) é recriado a cada execução. Os testes CT01 a CT54 (Sprints 01 a 03) continuam na suíte como regressão. Resultado da última execução: **72 testes aprovados em 8 suítes**.

| ID | Cenário | Requisito / critério | Resultado |
|---|---|---|---|
| CT55 | Datas que não existem no calendário (30/02, 31/04, 29/02 fora de ano bissexto) são recusadas em cadastro, filtro de período e disponibilidade; 29/02/2028 é aceito | RNF07, CA15 | **BUG-07 → corrigido e aprovado** |
| CT56 | Corpo acima de 100 KB recebe 413 com mensagem clara | RNF08 | **BUG-08 → corrigido e aprovado** |
| CT57 | 20 falhas de login da mesma origem, com e-mails diferentes, bloqueiam a origem | RNF04, RNF05, CA13 | **BUG-09 → corrigido e aprovado** |
| CT58 | Todas as rotas, exceto o login, recusam acesso sem token, com token vencido e com token sem assinatura (401); as rotas são lidas dos roteadores | RNF04, CA13 | Aprovado |
| CT59 | Todas as rotas de alteração recusam o perfil de consulta (403) | RNF04, CA13 | Aprovado |
| CT60 | Usuário desativado perde o acesso na hora, mesmo com sessão aberta | RNF04, RNF05 | Aprovado |
| CT61 | Erro inesperado não expõe consulta, tabela ou pilha; rota inexistente responde 404 | RNF08 | Aprovado |
| CT62 | Cabeçalhos de segurança presentes e CORS restrito à origem configurada | RNF05 | Aprovado |
| CT63 | Nenhuma consulta devolve hash de senha ou e-mail de outros usuários | RNF06, CA14 | Aprovado |
| CT64 | Veículo inativado sai das listas, dos indicadores e da disponibilidade; aparece na consulta de inativos com data, responsável e motivo; o histórico continua consultável | RF03, RNF09 | Aprovado |
| CT65 | Inativação recusada com movimentação em aberto (409), sem motivo (400), repetida (409) e de veículo inexistente (404) | RNF09, CA15 | Aprovado |
| CT66 | Reativação devolve o veículo à operação e limpa os dados da inativação | RF03 | Aprovado |
| CT67 | Placa ou código de veículo inativo: o cadastro orienta a reativar em vez de duplicar; veículo inativo não pode ser editado | RNF09, CA15 | Aprovado |
| CT68 | Inativação de condutor registra data, responsável e motivo; motivo sem inativação é recusado; a reativação limpa; o histórico continua | RF05, RNF09 | Aprovado |
| CT69 | O banco recusa excluir cadastros, movimentações e eventos, alterar eventos e deixar inativação sem data | RNF09 | Aprovado |
| CT70 | Inativação e empréstimo simultâneos do mesmo veículo: o resultado é sempre coerente | RNF09 | Aprovado |
| CT71 | Os filtros de prazo (devoluções atrasadas e retiradas de hoje) listam exatamente as movimentações contadas nos indicadores | RF14, CA10 | Aprovado |
| CT72 | Os indicadores de veículos e condutores somam só os cadastros ativos | RF14, CA10 | Aprovado |

## 2. Testes automatizados de navegador (versionados em `e2e/`)

Comando: `npm run test:e2e` com o sistema em execução e a senha dos usuários de demonstração em `E2E_SENHA`. Os testes criam os próprios veículos e condutores e os inativam ao final, para não alterar os dados de demonstração. Resultado da última execução: **13 testes aprovados**.

| ID | Cenário | Resultado |
|---|---|---|
| E2E-01 | Ciclo completo: cadastro de condutor e de veículo → empréstimo → devolução (quilometragem menor recusada) → histórico do veículo e do condutor (Sprint 03, ajustado para usar veículo próprio) | Aprovado |
| E2E-02 | Perfil de consulta vê o histórico e não tem a ação de devolução (Sprint 03) | Aprovado |
| E2E-03 | Senha errada recebe mensagem genérica; o acesso correto abre a tela inicial | Aprovado |
| E2E-04 | Os números da tela inicial coincidem com as listas que eles abrem; o menu volta a lista ao padrão | Aprovado |
| E2E-05 | Veículo: placa inválida recusada no formulário, cadastro, edição, inativação com motivo obrigatório, consulta de inativos e reativação | Aprovado |
| E2E-06 | Reserva: o veículo reservado não é oferecido em período conflitante e volta a ser oferecido após o cancelamento com motivo | Aprovado |
| E2E-07 | Perfil de consulta vê a tela inicial e as listas, sem ações de alteração | Aprovado |
| E2E-08 | Endereço protegido pede login e, depois dele, volta ao endereço com o filtro; sair encerra a sessão | **Reprovado → BUG-10 → corrigido e aprovado** |
| E2E-09 | As quatro telas em 390, 768, 1366 e 1920 px de largura, sem rolagem horizontal; menu em botão nas telas pequenas (4 testes) | Aprovado |
| E2E-10 | Login só pelo teclado (Tab entre os campos e Enter) | Aprovado |

## 3. Teste do fluxo na interface (roteiro com capturas)

| ID | Passo | Resultado esperado | Resultado |
|---|---|---|---|
| TF48 | Entrar como gestor | Tela Início com veículos, movimentações (atrasada e retirada de hoje) e condutores | Aprovado |
| TF49 | Clicar em "Em manutenção" | Veículos com o filtro de situação e o mesmo número | Aprovado |
| TF50 | Clicar em "Devoluções atrasadas" | Movimentações só com o empréstimo atrasado; filtro removível | Aprovado |
| TF51 | Tela Início em 390 px | Cartões empilhados, sem rolagem horizontal | Aprovado |
| TF52 | Entrar como consulta | Tela Início e listas, sem ações de cadastro ou inativação | Aprovado |
| TF53 | Inativar veículo sem e com motivo | Motivo obrigatório; com motivo, o veículo sai da lista de ativos | Aprovado |
| TF54 | Inativar veículo com empréstimo em aberto | Recusado com mensagem clara | Aprovado |
| TF55 | Filtro "Cadastro: Inativos" | Lista os inativos; a dica mostra data, responsável e motivo | Aprovado |
| TF56 | Histórico de veículo inativo | Continua disponível | Aprovado |
| TF57 | Cadastrar a placa de um veículo inativo | Recusado com orientação para reativar | Aprovado |
| TF58 | Reativar o veículo | Volta à lista de ativos com a situação anterior | Aprovado |
| TF59 | Inativar condutor com motivo | Data, responsável e motivo mostrados no cadastro | Aprovado |
| TF60 | Abrir endereço protegido sem sessão e entrar | Volta ao endereço com o filtro (reteste BUG-10) | Aprovado |
| TF61 | Tela Veículos em 768 px | Filtros em duas colunas e lista em cartões, sem rolagem horizontal | Aprovado |

## 4. Desempenho das consultas

Comando: `npm --prefix backend run medir:desempenho`. O script recria o banco **de testes** com 500 veículos, 1.000 condutores e 30.000 movimentações fictícias (90.000 eventos) e mede cada consulta 30 vezes pela própria API, sem rede. O volume é maior que o de uso diário esperado, mas **não** foi informado pelo Departamento de Frotas; o tamanho real da frota fica para confirmação na validação.

Resultado em 27/11/2026 (Linux, 2 núcleos, Node.js 22):

| Consulta | Mediana (ms) | 95% até (ms) |
|---|---:|---:|
| Lista de veículos ativos (todos) | 10,9 | 14,6 |
| Lista de veículos com busca | 8,0 | 11,0 |
| Resumo de veículos | 2,4 | 3,5 |
| Lista de condutores ativos (todos) | 16,0 | 18,8 |
| Resumo de condutores | 4,2 | 6,6 |
| Movimentações: 1ª página (25) | 46,0 | 77,5 |
| Movimentações: período de 30 dias | 20,5 | 27,5 |
| Movimentações: busca por placa | 159,9 | 252,5 |
| Movimentações: devoluções atrasadas | 3,8 | 4,8 |
| Resumo das movimentações | 7,0 | 9,0 |
| Disponibilidade para reserva | 3,2 | 4,6 |
| Histórico de um veículo (1ª página) | 6,5 | 7,7 |
| Histórico de um condutor (1ª página) | 6,7 | 9,1 |

- A primeira página das movimentações levava cerca de 170 ms (mediana) antes do ajuste do commit `perf(api)`, que passou a montar veículo e condutor só para os itens da página.
- A busca textual nas movimentações é a consulta mais lenta (cerca de 160 ms com 30 mil movimentações). Se o volume real crescer muito além disso, um índice de busca textual pode ser avaliado.
- **Não** foram feitos testes de carga com muitos usuários ao mesmo tempo, nem medições pela rede da empresa.
- Interface: o build gerava um único arquivo de 736 kB (228 kB compactado). Com as telas carregadas sob demanda e as bibliotecas separadas, o maior arquivo tem 335 kB (100 kB compactado); o total baixado no primeiro acesso praticamente não mudou.

## 5. Compatibilidade

| Ambiente | O que foi executado | Resultado |
|---|---|---|
| Google Chrome (Linux) | Testes de navegador E2E-01 a E2E-10 e roteiro TF48–TF61 | Aprovado |
| Microsoft Edge (Windows, computador do aluno) | Testes de navegador pelo script de execução da sprint | Registrado no Trello e no relatório após a execução |
| Larguras de tela | 390, 768, 1366 e 1920 px (simuladas no navegador) | Aprovado |

Não foram testados Firefox, Safari nem aparelhos celulares reais; o comportamento em celular foi verificado só com a largura simulada no navegador.

## 6. Falhas encontradas e corrigidas

| ID | Falha | Causa | Correção | Reteste |
|---|---|---|---|---|
| BUG-07 | Datas inexistentes (30/02) aceitas e convertidas; filtro de período com erro interno | O validador de datas do Joi converte o dia excedente para o mês seguinte | Validador comum que confere o calendário (commit `fix(api)`) | Aprovado (CT55) |
| BUG-08 | Corpo acima de 100 KB respondido como erro interno (500) | O erro de tamanho do Express não era tratado | Resposta 413 com mensagem clara (commit `fix(api)`) | Aprovado (CT56) |
| BUG-09 | Era possível testar uma senha em muitas contas sem bloqueio; registro de tentativas sem limite | O bloqueio considerava só o par origem + e-mail | Limite de 20 falhas por origem e descarte dos registros vencidos (commit `fix(api)`) | Aprovado (CT57) |
| BUG-10 | Depois do login, o sistema ia sempre para a tela inicial, e não para o endereço protegido aberto antes | A rota de login redirecionava antes de a tela de login aplicar o endereço de origem | Redirecionamento só na rota de login, com o endereço de origem e seus filtros (commit `fix(web)`) | Aprovado (E2E-08 e TF60) |
