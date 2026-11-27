# Regras de condutores, reservas e empréstimos (Sprint 02)

Regras aplicadas pela API em `backend/src/routes/condutores.ts` e `backend/src/routes/reservas.ts`. A interface apenas antecipa as mesmas verificações; a decisão final é sempre do servidor.

As regras estão separadas pela origem: o que foi combinado com o Departamento de Frotas, o que vem dos requisitos do projeto e o que foi decidido pela equipe para completar o fluxo. As decisões da equipe serão apresentadas ao Departamento de Frotas na validação e ajustadas se necessário.

## 1. Combinadas com o Departamento de Frotas

| Regra | Comportamento | Resposta da API |
|---|---|---|
| Quem registra | O próprio Departamento de Frotas registra a reserva ou o empréstimo (perfis `admin` e `gestor_frota`). Não há etapa de solicitação e aprovação no módulo Web. | 403 para o perfil `visualizador` |
| Veículos POOL | Só veículos POOL podem ser reservados ou emprestados; veículos de uso atribuído ficam de fora. | 422 |
| Liberação do condutor | Só condutores liberados pelo Departamento de Frotas podem receber veículos POOL. | 422 |
| CNH vencida | Condutor com CNH vencida não recebe veículo. | 422 |
| Dados da CNH | São guardados apenas a categoria e a validade (minimização de dados pessoais). O número da CNH não é armazenado. | — |

## 2. Requisitos do projeto

| Regra | Origem | Comportamento | Resposta da API |
|---|---|---|---|
| Conflito de período | CA04 | O mesmo veículo não pode ter duas reservas ou empréstimos com períodos sobrepostos. | 409 |
| Dados obrigatórios e válidos | RNF07, CA15 | Veículo, condutor, previsão de devolução e finalidade são obrigatórios; o início da reserva também. | 400 |
| Integridade | RNF09 | Matrícula única; não é possível retirar a liberação nem inativar um condutor com reserva ou empréstimo em aberto; a situação de um veículo emprestado só muda com a devolução; um veículo com reserva não passa para uso atribuído; um veículo POOL só fica *em uso* por meio de um empréstimo ou de uma retirada. | 409 / 422 |
| Registros simultâneos | RNF09 | O veículo é bloqueado na transação; dois registros ao mesmo tempo para o mesmo período resultam em apenas um aceito. | 409 |

## 3. Decisões técnicas da equipe (a confirmar na validação)

| Decisão | Comportamento |
|---|---|
| Validade da CNH no período | A CNH precisa valer até o fim do período da reserva, não só no dia do registro. |
| CNH "vencendo" | Sinalizada quando faltam até 30 dias para o vencimento (apenas aviso; não bloqueia). |
| Veículo em manutenção ou indisponível | Não pode ser reservado nem emprestado. |
| Períodos encostados | Aceitos: uma reserva pode começar no mesmo horário em que a anterior termina. |
| Início e antecedência | O início da reserva não pode estar no passado; antecedência máxima de 365 dias. |
| Retirada antecipada | Permitida antes do horário previsto, desde que o período antecipado também esteja livre. |
| Cancelamento | Só para reservas agendadas, com motivo obrigatório; o período volta a ficar livre. Veículo já retirado é encerrado pela devolução (Sprint 03). |
| Empréstimo atrasado | Continua ocupando o veículo até a devolução, mesmo depois da previsão. |
| Histórico | Registro, retirada e cancelamento ficam em `reserva_eventos`, com usuário e horário. |

## Fora desta sprint

- Registro da devolução e liberação da disponibilidade (Sprint 03).
- Solicitação de reserva pelo colaborador no aplicativo Mobile (disciplina Programação Mobile Aplicada).
