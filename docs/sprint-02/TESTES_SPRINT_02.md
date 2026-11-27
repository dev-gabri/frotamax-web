# Sprint 02 — Registro de testes

Incremento testado: condutores e reservas/empréstimos de veículos POOL com verificação de disponibilidade (API + interface Web), além da regressão da Sprint 01.
Todos os testes usaram somente dados fictícios em ambiente local (PostgreSQL 16, Node.js 22, Google Chrome).

## 1. Testes automatizados da API (Jest + Supertest)

Comando: `npm --prefix backend test`. O banco de testes (`frotamax_test`) é recriado a cada execução. Os testes CT01 a CT24 (Sprint 01) continuam na suíte como regressão.

| ID | Cenário | Requisito / critério | Resultado |
|---|---|---|---|
| CT25 | Cadastro de condutor; matrícula e categoria normalizadas | RF05, CA03 | Aprovado |
| CT26 | Campos obrigatórios e formatos inválidos rejeitados com mensagens claras (400) | RNF07, CA15 | Aprovado |
| CT27 | Matrícula já cadastrada rejeitada (409) | RNF09 | Aprovado |
| CT28 | Perfil de consulta lista condutores, mas não cadastra nem edita (403); sem login, 401 | RNF04, RNF05, CA13 | Aprovado |
| CT29 | Liberação para o POOL salva e recuperada em nova consulta | RF05, CA03 | Aprovado |
| CT30 | Situação da CNH (válida, vencendo, vencida) usada nos filtros e no resumo | RF05, RF13, CA09 | Aprovado |
| CT31 | Reserva válida de veículo POOL registrada como agendada, com evento de registro | RF06, CA04 | Aprovado |
| CT32 | Período conflitante para o mesmo veículo rejeitado (409); período encostado aceito | RF06, RF07, CA04 | Aprovado |
| CT33 | Veículo de uso atribuído ou em manutenção não pode ser reservado (422) | RF07, CA04 | Aprovado |
| CT34 | Condutor sem liberação, com CNH vencida ou que vence durante o período é recusado (422) | RF06, RNF09 | Aprovado |
| CT35 | Período invertido, início no passado e campos ausentes rejeitados | RNF07, CA15 | Aprovado |
| CT36 | Empréstimo registra a retirada imediata e coloca o veículo em uso; segundo empréstimo do mesmo veículo recusado (409) | RF06, RF07, CA04 | Aprovado |
| CT37 | Disponibilidade lista só veículos POOL livres no período | RF07, CA04 | Aprovado |
| CT38 | Retirada de reserva agendada coloca reserva e veículo em uso; nova retirada recusada | RF07 | Aprovado |
| CT39 | Cancelamento exige motivo, libera o período e não se aplica a veículo já retirado | RF06, RNF09 | Aprovado |
| CT40 | Perfil de consulta acompanha reservas, mas não registra, retira nem cancela (403); sem login, 401 | RNF04, RNF05, CA13 | Aprovado |
| CT41 | Integridade: veículo emprestado não muda de situação manualmente; POOL não fica "em uso" sem empréstimo; veículo com reserva não passa a uso atribuído; condutor com reserva em aberto não é inativado | RNF09 | Aprovado |
| CT42 | Três registros simultâneos para o mesmo veículo e período: apenas um aceito | RNF09, CA04 | Aprovado |

Resultado da última execução: **42 aprovados de 42** (24 da Sprint 01 e 18 da Sprint 02).

## 2. Teste do fluxo na interface (navegador)

Roteiro executado no Google Chrome, com a API e o front-end em execução local e os dados fictícios do `db:seed`.

| ID | Passo | Resultado esperado | Resultado |
|---|---|---|---|
| TF15 | Abrir Condutores como gestor | Indicadores, situação da CNH e liberação para o POOL na lista | Aprovado |
| TF16 | Cadastrar condutor com campos vazios e matrícula inválida | Mensagens por campo, sem chamar a API | Aprovado |
| TF17 | Cadastrar condutor válido, liberado para o POOL (matrícula `m-1007`) | Cadastro salvo como `M-1007` e indicadores atualizados | Aprovado |
| TF18 | Cadastrar matrícula repetida | Mensagem da API "Já existe um condutor cadastrado com esta matrícula." | Aprovado |
| TF19 | Filtrar por CNH vencida | Só o condutor com CNH vencida | Aprovado |
| TF20 | Inativar condutor com empréstimo em andamento | Operação recusada com explicação | Aprovado |
| TF21 | Abrir Reservas e empréstimos | Indicadores, empréstimo em uso e reservas agendadas | **Ajuste → BUG-04 → corrigido e aprovado no reteste (TF33)** |
| TF22 | Nova reserva para amanhã, 09h–12h | Só veículos POOL livres; o reservado, o atribuído e o em manutenção não aparecem | Aprovado |
| TF23 | Escolher condutor cuja CNH vence durante o período | Mensagem "A CNH vence em ..., antes do fim do período." | Aprovado |
| TF24 | Registrar reserva válida | Reserva agendada e indicadores atualizados | Aprovado |
| TF25 | Nova reserva no mesmo horário | O veículo recém-reservado não é oferecido | Aprovado |
| TF26 | Registrar empréstimo com retirada imediata | Empréstimo em uso e veículo em uso | Aprovado |
| TF27 | Registrar a retirada de reserva agendada | Reserva e veículo passam para "Em uso" | Aprovado |
| TF28 | Cancelar reserva sem motivo e depois com motivo | Exige motivo; após o cancelamento, a reserva fica "Cancelada" | **Reprovado → BUG-03 → corrigido e aprovado no reteste (TF34)** |
| TF29 | Abrir os detalhes da reserva retirada | Histórico com registro e retirada, usuário e horário | Aprovado |
| TF30 | Em Veículos, tentar mudar a situação do veículo emprestado | Opção "Em uso" não oferecida para POOL; mudança recusada até a devolução | Aprovado |
| TF31 | Tela de 390 px (celular) | Lista em cartões e formulário em tela cheia | Aprovado |
| TF32 | Entrar como perfil de consulta | Reservas e condutores sem ações de alteração | Aprovado |
| TF33 | Reteste BUG-04 | Detalhes, retirada e cancelamento na mesma linha | Aprovado |
| TF34 | Reteste BUG-03 | A mensagem de erro do motivo some ao preencher o campo | Aprovado |

## 3. Falhas encontradas e corrigidas

| ID | Falha | Causa | Correção | Reteste |
|---|---|---|---|---|
| BUG-03 | No cancelamento de reserva, a mensagem "Descreva o motivo..." continuava em vermelho depois que o motivo era preenchido | O erro do campo só era recalculado ao enviar o formulário | O erro de cada campo é limpo assim que o campo muda, no cancelamento e nos formulários de reserva e de condutor (commit `fix(web)`) | Aprovado |
| BUG-04 | Na tabela de reservas, o botão de cancelar quebrava para uma segunda linha, abaixo de "Retirada" | A célula de ações permitia quebra de linha | Ações em uma única linha, sem quebra | Aprovado |
