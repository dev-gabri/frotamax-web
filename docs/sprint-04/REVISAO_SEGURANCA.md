# Sprint 04 — Revisão de segurança e privacidade

Revisão feita em 27/11/2026 sobre o que está realmente implementado (API, interface Web e repositório), em ambiente local e com dados fictícios. Cada item indica **como** foi verificado. Os achados viraram cards de correção (BUG-07, BUG-08 e BUG-09), corrigidos e retestados.

## 1. O que foi verificado

| Área | Como foi verificado | Resultado |
|---|---|---|
| Autenticação em todas as rotas | CT58: as rotas são lidas dos próprios roteadores do Express (24 rotas protegidas) e chamadas sem token, com token vencido e com token sem assinatura (`alg: none`) | Todas respondem 401; só `POST /api/auth/login` e `GET /api/health` são públicas |
| Autorização no servidor | CT59: as 11 rotas de alteração chamadas com o perfil de consulta | Todas respondem 403 |
| Usuário desativado com sessão aberta | CT60: o usuário é desativado no banco com o token ainda válido | A próxima requisição responde 401 (o perfil e a situação são lidos do banco a cada requisição) |
| Força bruta no login | CT09 (por e-mail) e CT57 (por origem, com e-mails diferentes) | Bloqueio após 5 falhas do mesmo e-mail e após 20 falhas da mesma origem, por 15 minutos (BUG-09) |
| Validação de entradas | Testes CT05, CT45, CT55 e sondagem manual (datas impossíveis, parâmetros repetidos, JSON malformado, tipo de conteúdo errado, identificadores inválidos) | Entradas inválidas recebem 400 com mensagem; datas como 30/02 eram aceitas e convertidas (BUG-07, corrigido) |
| Mensagens de erro | CT56 e CT61 (falha simulada do banco) | Respostas sem consulta SQL, nome de tabela ou pilha; corpo acima de 100 KB recebia 500 (BUG-08, corrigido para 413) |
| Cabeçalhos HTTP e CORS | CT62 | Cabeçalhos do Helmet presentes (incluindo `X-Content-Type-Options`, `X-Frame-Options` e CSP da API), sem `X-Powered-By`; CORS só libera a origem configurada |
| Exposição de dados | CT63: todas as consultas `GET` sem parâmetro | Nenhuma resposta traz hash de senha nem e-mail de outros usuários |
| Sessão na interface | Leitura do código (`AuthContext`, `apiService`) | Token no `sessionStorage` (apagado ao fechar o navegador) e revalidado em `/auth/me`; resposta 401 encerra a sessão |
| Dependências | `npm audit` na raiz, no backend e no frontend | Vulnerabilidades encontradas no Vite, no esbuild, no React Router, no minimatch (usado pelo nodemon) e no Playwright; todas resolvidas com atualização. Resultado final: 0 vulnerabilidades nos três (evidência `resultado_npm_audit.txt`) |
| Segredos no repositório | Busca em todo o histórico do Git por arquivos `.env`, chaves, tokens (padrões de GitHub, AWS, JWT e chaves privadas) e senhas atribuídas | Só existem `.env.example` com valores de exemplo; nenhum segredo real. `backend/.env` continua fora do Git |
| Dados pessoais | Leitura do modelo de dados e das respostas da API | Da CNH ficam só categoria e validade; nome, matrícula e telefone do condutor são os únicos dados pessoais |
| Integridade do histórico | CT69 | O banco recusa excluir usuários, veículos, condutores, movimentações e eventos, e recusa alterar eventos |

## 2. Achados e correções

| ID | Achado | Risco | Correção | Reteste |
|---|---|---|---|---|
| BUG-07 | O validador de datas aceitava dias inexistentes (30/02 virava 02/03 sem aviso) e o filtro de período respondia erro interno com essas datas | Dado gravado diferente do informado; erro interno exposto como 500 | Validador comum que confere o calendário em todas as datas da API | CT55 |
| BUG-08 | Corpo de requisição acima de 100 KB era respondido como erro interno (500) | Mensagem confusa e registro de erro indevido | Resposta 413 com mensagem clara (e 415 para codificação não suportada) | CT56 |
| BUG-09 | O bloqueio do login valia só para o par origem + e-mail: era possível testar uma senha em muitas contas, e o registro de tentativas crescia sem limite | Tentativa de senha em várias contas; consumo de memória | Limite adicional de 20 falhas por origem e descarte dos registros vencidos | CT57 |
| — | Dependências com vulnerabilidades conhecidas | Servidor de desenvolvimento do Vite acessível por outros sites, redirecionamento aberto no React Router, negação de serviço no minimatch, download de navegador sem verificação no Playwright | Vite 6.4, React Router 7.18, minimatch 11 para o nodemon, Playwright 1.65 | `npm audit` sem vulnerabilidades; 72 testes da API e testes de navegador aprovados |

## 3. Limitações conhecidas e pontos para a implantação

Estes pontos **não** foram resolvidos no MVP, porque dependem do ambiente corporativo (CA18) ou de decisão do Departamento de Frotas:

1. **HTTPS e servidor de produção:** o sistema roda localmente em HTTP. A publicação exige HTTPS, um servidor para a interface com política de segurança de conteúdo (CSP) e a definição de quem administra o servidor, conforme a Gestão de TI.
2. **Sessão sem revogação imediata do token:** o token vale até 8 horas. Desativar o usuário bloqueia o acesso na hora (CT60), mas não há encerramento remoto de uma sessão específica.
3. **Limite de tentativas em memória:** o bloqueio do login é reiniciado quando a API reinicia e não é compartilhado entre várias instâncias. Para um único servidor, como no MVP, é suficiente.
4. **Gestão de usuários:** não há tela de cadastro de usuários nem troca de senha; os usuários de demonstração são criados pelo seed. A forma de acesso dos usuários reais (contas locais ou login corporativo) precisa ser definida com a TI.
5. **Telefone do condutor visível ao perfil de consulta:** o perfil de consulta vê o telefone dos condutores. Fica para decisão com o Departamento de Frotas (pergunta no formulário de validação).
6. **Registro de auditoria:** as movimentações têm registro de eventos com usuário e horário; os cadastros guardam quem criou, quem alterou por último e a inativação em vigor. Não há histórico completo de cada alteração de cadastro.
7. **Backup do banco:** não faz parte do MVP local e precisa ser definido na implantação.
