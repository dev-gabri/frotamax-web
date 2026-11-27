# Sprint 04 — Roteiro de demonstração e validação com o Departamento de Frotas

Roteiro para apresentar o MVP do Frota Max Web ao representante da instituição, **Marcos Aparecido de Souza** (Supervisor Administrativo de Frota), e à equipe do Departamento de Frotas, e para coletar o retorno no formulário `FORMULARIO_VALIDACAO.md`.

- **Duração prevista:** 40 a 50 minutos (30 de demonstração e 10 a 20 de conversa e preenchimento do formulário).
- **Quem conduz:** Gabriel Pedro Neto França.
- **Regra principal:** mostrar somente o que está pronto e testado. O que não foi feito (quilometragem avulsa, manutenção completa, checklist, integrações RST e Ticket Log, aplicativo Mobile) é apresentado como evolução futura, sem promessa de prazo.
- **Dados:** somente fictícios. Não digitar dados reais da empresa, de veículos ou de colaboradores durante a demonstração.

## 1. Preparação (antes da reunião)

1. No computador da demonstração, recriar os dados fictícios para começar de um estado conhecido:
   ```bash
   npm run db:recriar -- --confirmar
   ```
2. Conferir os testes automatizados e iniciar o sistema:
   ```bash
   npm --prefix backend test
   npm run dev
   ```
3. Abrir http://localhost:3000 no navegador em tela cheia e testar o login dos três usuários de demonstração.
4. Levar o formulário de validação impresso (ou aberto em outra janela) e combinar com o representante se é permitido tirar fotos ou prints da reunião.

## 2. Roteiro

Para cada etapa: o que mostrar, o que deve acontecer e a pergunta para o representante. O critério de aceitação (CA) do relatório fica indicado para o registro do resultado.

| Etapa | O que mostrar | Resultado esperado | Critério | Pergunta para o representante |
|---|---|---|---|---|
| 1. Acesso | Entrar como gestor (`gestor@frotamax.local`); tentar uma senha errada antes | Mensagem genérica na senha errada; com a senha certa, abre a tela Início | CA13 | Os perfis (administrador, gestor de frota e consulta) atendem às pessoas do setor? |
| 2. Tela Início | Números de veículos, movimentações e condutores; clicar em "Devoluções atrasadas" e em "Em manutenção" | Cada número abre a lista correspondente já filtrada | CA10 | Estes são os números que o setor acompanha no dia a dia? Falta algum? |
| 3. Veículos | Buscar por placa, filtrar por situação, cadastrar um veículo fictício (tentar primeiro uma placa inválida), editar, alterar a situação | Placa inválida recusada; veículo cadastrado aparece na busca; situação atualizada | CA01, CA02, CA15 | Os campos do cadastro correspondem aos da planilha atual? |
| 4. Inativação | Inativar o veículo fictício com motivo; mostrar o filtro "Inativos"; reativar | Veículo sai da lista, o histórico continua e a reativação o devolve | RNF09 | Como o setor trata hoje um veículo vendido ou devolvido? |
| 5. Condutores | Cadastrar um condutor fictício, mostrar a situação da CNH e a liberação para o POOL | Condutor localizado na busca; CNH vencida destacada | CA03 | Quem deve poder ver o telefone dos condutores? |
| 6. Reserva | Registrar uma reserva para amanhã; abrir nova reserva no mesmo horário | O veículo reservado não aparece entre os livres no período conflitante | CA04 | As regras combinadas (liberação para o POOL, CNH válida, sem conflito) estão corretas? |
| 7. Empréstimo e devolução | Registrar um empréstimo; registrar a devolução com quilometragem (tentar uma menor que a de saída) e observação; mostrar a opção de enviar para manutenção | Quilometragem menor recusada; devolução encerra o empréstimo e libera o veículo | CA05 | A devolução registra o que o setor precisa? |
| 8. Histórico e consultas | Histórico de utilização do veículo e do condutor; filtro de movimentações por período | Movimentações com quilometragem percorrida e atrasos | CA08, CA09 | O histórico substitui a consulta que hoje é feita na planilha? |
| 9. Perfil de consulta | Sair e entrar como `consulta@frotamax.local` | Vê as telas, sem botões de cadastro, alteração ou devolução | CA13 | Alguém do setor deveria ter esse perfil? |
| 10. Celular (opcional) | Reduzir a janela do navegador ou usar o modo de celular | Menu vira botão e as listas viram cartões | CA12 | O setor usaria o sistema pelo celular? |

## 3. Encerramento

1. Pedir ao representante que preencha o formulário de validação (ou preencher junto, com as palavras dele).
2. Registrar as sugestões separando: **defeito** (algo que não funciona como combinado), **ajuste no MVP** (pequeno e possível antes da entrega) e **evolução futura**.
3. Defeitos e ajustes viram cards no Trello; evoluções ficam no Product Backlog.
4. **Não registrar o MVP como validado sem o formulário preenchido ou outra evidência da reunião** (ata, e-mail ou mensagem do representante).
5. O Termo de Entrega do MVP exigido pelo Guia do Aluno é um documento à parte e só é assinado se o representante concordar.
