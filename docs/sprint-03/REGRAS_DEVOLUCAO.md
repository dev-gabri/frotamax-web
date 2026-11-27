# Sprint 03 — Regras da devolução e do histórico de utilização

As regras estão separadas pela origem, para deixar claro o que foi combinado com a instituição e o que foi decidido pela equipe.

## 1. Combinadas com o Departamento de Frotas

| Regra | Onde é aplicada |
|---|---|
| Na devolução são registrados a data e a hora, a quilometragem de chegada e uma observação | API `POST /api/reservas/:id/devolucao` e formulário de devolução |
| A quilometragem de chegada atualiza a do veículo e não pode ser menor que a registrada | API (422) e formulário |
| Se o veículo voltar com problema, o Departamento de Frotas pode enviá-lo para manutenção no próprio registro da devolução | API (situação "Em manutenção") e formulário (opção "enviar para manutenção") |
| A devolução é registrada pelo próprio Departamento de Frotas (mesma regra das reservas da Sprint 02) | Permissão `reservas:gerenciar` (administrador e gestor de frota) |

## 2. Requisitos do projeto

| Requisito / critério | Como foi atendido |
|---|---|
| RF08 e CA05 — registrar a devolução de uma movimentação ativa, encerrando a utilização e atualizando a disponibilidade | A devolução só vale para empréstimos e reservas em uso; a movimentação fica "Concluída" e o veículo volta a "Disponível" (ou vai para "Em manutenção") |
| RF12 e CA08 — consultar o histórico de utilização de cada veículo | Histórico por veículo e por condutor, com resumo, quilometragem percorrida e devoluções com atraso |
| RF13 e CA09 — pesquisar e filtrar | Consulta de movimentações por período, situação e tipo |
| RNF09 — consistência dos dados | Transação com bloqueio do veículo; duas devoluções simultâneas não são registradas |
| RNF10 — desempenho adequado | Consultas de movimentações e de histórico paginadas, com índices por veículo e por condutor |

## 3. Decisões técnicas da equipe (a confirmar na validação com o Departamento de Frotas)

| Decisão | Motivo |
|---|---|
| A data e a hora da devolução começam com o horário atual e podem ser alteradas, mas não podem ser futuras nem anteriores à retirada | Permitir registrar uma devolução feita mais cedo sem criar datas impossíveis |
| Uma devolução informada no mesmo minuto da retirada usa o horário da retirada | O campo de data trabalha em minutos e a retirada fica gravada com segundos (BUG-06) |
| O envio para manutenção exige a descrição do problema (mínimo de 5 caracteres) | A equipe de manutenção precisa saber o motivo |
| Reservas futuras de um veículo enviado para manutenção não são canceladas automaticamente: a tela avisa quais são e a retirada fica bloqueada enquanto o veículo estiver em manutenção | O cancelamento de uma reserva é decisão do Departamento de Frotas |
| A quilometragem na retirada é copiada do veículo automaticamente | Calcular os quilômetros percorridos em cada utilização sem pedir mais um dado na retirada |
| Devolução depois da previsão é aceita e marcada como "com atraso" no histórico | O atraso precisa ficar registrado, mas o veículo precisa voltar para a frota |
| O histórico de veículos e condutores inativos continua disponível | Não perder a rastreabilidade quando um cadastro deixa de ser usado |
