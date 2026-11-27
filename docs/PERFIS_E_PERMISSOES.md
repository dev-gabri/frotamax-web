# Perfis e permissões (MVP)

Os perfis foram mantidos no mínimo necessário para o primeiro incremento. Os usuários do módulo Web são os profissionais do Departamento de Frotas, conforme a seção 4.2 do relatório.

| Perfil | Quem representa | Consultar veículos, condutores, reservas e histórico de utilização | Cadastrar e editar veículos e condutores | Registrar, retirar, cancelar e devolver reservas e empréstimos |
|---|---|:---:|:---:|:---:|
| `admin` | Administração técnica da aplicação | ✔ | ✔ | ✔ |
| `gestor_frota` | Supervisão e equipe do Departamento de Frotas | ✔ | ✔ | ✔ |
| `visualizador` | Usuários que só acompanham as informações | ✔ | ✘ (HTTP 403) | ✘ (HTTP 403) |

A liberação de um condutor para o POOL faz parte da edição do condutor (`admin` e `gestor_frota`). O registro da devolução (Sprint 03), inclusive o envio do veículo para manutenção, usa a mesma permissão das reservas (`reservas:gerenciar`).

## Regras

- **Permissão sempre conferida no servidor:** toda rota protegida passa por `authenticate` (sessão válida) e `authorize` (permissão do perfil).
- **Interface só reflete a API:** a tela esconde as ações que o perfil não pode executar, mas a API recusa a operação mesmo que alguém tente chamá-la diretamente.
- **Perfil vem do banco:** o perfil considerado é o que está no banco no momento da requisição. Por isso, uma alteração de perfil ou a desativação do usuário vale imediatamente.
- **Onde ficam as permissões:** em `backend/src/config/permissoes.ts` (`veiculos:*`, `condutores:*` e `reservas:*`).
