# Sprint 03 — Registro de testes

Incremento testado: devolução de veículos, atualização da disponibilidade e histórico de utilização (API + interface Web), além da regressão das Sprints 01 e 02.
Todos os testes usaram somente dados fictícios em ambiente local (PostgreSQL 16, Node.js 22, Google Chrome).

## 1. Testes automatizados da API (Jest + Supertest)

Comando: `npm --prefix backend test`. O banco de testes (`frotamax_test`) é recriado a cada execução. Os testes CT01 a CT42 (Sprints 01 e 02) continuam na suíte como regressão. Resultado da última execução: **54 testes aprovados em 5 suítes**.

| ID | Cenário | Requisito / critério | Resultado |
|---|---|---|---|
| CT43 | Devolução de empréstimo em andamento: movimentação concluída, veículo disponível, quilometragem atualizada e eventos registro → retirada → devolução | RF08, CA05 | **Reprovado → BUG-05 → corrigido e aprovado** |
| CT44 | Após a devolução, o veículo volta a ser oferecido e aceita um novo empréstimo (ciclo completo) | RF07, RF08, CA05 | Aprovado |
| CT45 | Quilometragem de chegada menor que a do veículo recusada (422) sem alterar nada; quilometragem ausente (400); mesma quilometragem aceita | RF08, RNF09, CA15 | Aprovado |
| CT46 | Devolução só para movimentação em uso: agendada (422), já devolvida (409), cancelada (422), inexistente (404) | RF08, CA05 | Aprovado |
| CT47 | Data e hora da devolução: futura e anterior à retirada recusadas; mesmo minuto da retirada aceito (BUG-06); devolução tardia aceita e marcada "com atraso" | RF08, RNF09 | Aprovado |
| CT48 | Envio para manutenção na devolução: exige descrição, deixa o veículo "Em manutenção", informa a reserva futura afetada e bloqueia novas reservas e a retirada | RF08, CA05 | Aprovado |
| CT49 | Perfil de consulta não registra devolução (403); sem login, 401; dados inválidos, 400 | RNF04, RNF05, CA13, CA15 | Aprovado |
| CT50 | Duas devoluções simultâneas da mesma movimentação: apenas uma é registrada | RNF09 | Aprovado |
| CT51 | Histórico do veículo: resumo, movimentações da mais recente para a mais antiga, km percorridos, paginação, histórico vazio e veículo inexistente (404) | RF12, CA08, RNF10 | Aprovado |
| CT52 | Histórico do condutor: reservas, empréstimos e devoluções do condutor, com devoluções em atraso | RF12, CA08 | Aprovado |
| CT53 | Consulta de movimentações com filtro de período (formato e ordem das datas validados), situação e paginação | RF13, CA09, RNF10 | Aprovado |
| CT54 | Histórico preservado para veículo e condutor inativos | RNF09 | Aprovado |

## 2. Teste automatizado de navegador (versionado no repositório)

Ação definida na retrospectiva da Sprint 02. Arquivos em `e2e/`; comando `npm run test:e2e` com o sistema em execução (`npm run dev`) e a senha dos usuários de demonstração em `E2E_SENHA`. Usa o navegador instalado (Edge no Windows, Chrome nos demais sistemas).

| ID | Cenário | Resultado |
|---|---|---|
| E2E-01 | Cadastro de condutor → empréstimo → devolução com quilometragem menor recusada e correta aceita → histórico do veículo e do condutor | **Reprovado → BUG-06 → corrigido e aprovado** |
| E2E-02 | Perfil de consulta vê o histórico e não tem a ação de devolução | Aprovado |

## 3. Teste do fluxo na interface (roteiro com capturas)

| ID | Passo | Resultado esperado | Resultado |
|---|---|---|---|
| TF35 | Abrir Reservas e empréstimos | Ação "Devolução" só nos empréstimos em uso; encerradas depois das em aberto | Aprovado |
| TF36 | Registrar devolução sem quilometragem e com quilometragem menor | Mensagens no formulário, sem enviar | Aprovado |
| TF37 | Registrar devolução válida com observação | Empréstimo concluído, "Devolvido em" na lista, veículo disponível | Aprovado |
| TF38 | Abrir os detalhes da movimentação encerrada | Quilometragem percorrida, observação e eventos na ordem registro → retirada → devolução (reteste BUG-05) | Aprovado |
| TF39 | Registrar novo empréstimo | O veículo devolvido volta a ser oferecido | Aprovado |
| TF40 | Devolução com envio para manutenção | Exige descrição; veículo "Em manutenção"; aviso da reserva futura afetada | Aprovado |
| TF41 | Nova reserva para o dia seguinte | O veículo em manutenção não é oferecido | Aprovado |
| TF42 | Abrir Veículos | Situação e quilometragem atualizadas pelas devoluções | Aprovado |
| TF43 | Histórico de utilização de um veículo | Resumo, movimentações encerradas e em aberto, km percorridos e atraso | Aprovado |
| TF44 | Histórico de utilização de um condutor | Reservas, empréstimos, devoluções e cancelamentos do condutor | Aprovado |
| TF45 | Filtrar movimentações concluídas por período | Só as devoluções dentro do intervalo | Aprovado |
| TF46 | Tela de 390 px | Formulário de devolução e histórico em tela cheia | Aprovado |
| TF47 | Perfil de consulta | Vê o histórico, sem a ação de devolução | Aprovado |

## 4. Falhas encontradas e corrigidas

| ID | Falha | Causa | Correção | Reteste |
|---|---|---|---|---|
| BUG-05 | No detalhe de um empréstimo, os eventos "registro" e "retirada" podiam aparecer em ordem trocada | Os dois eventos eram gravados na mesma transação com o mesmo horário (`NOW()`), e a ordem entre eles ficava indefinida | Os eventos passam a usar `clock_timestamp()`, que avança dentro da transação (commit `fix(api)`) | Aprovado (CT43 e TF38) |
| BUG-06 | Uma devolução registrada no mesmo minuto da retirada era recusada como "anterior à retirada" | O campo de data e hora trabalha em minutos e a retirada fica gravada com segundos | O formulário só envia a data quando ela é alterada, e a API aceita o mesmo minuto da retirada usando o horário da retirada (commit `fix(api)`) | Aprovado (CT47 e E2E-01) |
