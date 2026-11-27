import bcrypt from 'bcryptjs';
import { pool } from './pool';
import { runMigrations } from './migrate';

/**
 * Carrega dados FICTÍCIOS para desenvolvimento e demonstração local.
 * Nenhum dado real da instituição é utilizado.
 * A senha dos usuários de demonstração vem da variável SEED_SENHA (arquivo .env local).
 */
const USUARIOS = [
  { nome: 'Administrador Demo', email: 'admin@frotamax.local', perfil: 'admin' },
  { nome: 'Gestor de Frota Demo', email: 'gestor@frotamax.local', perfil: 'gestor_frota' },
  { nome: 'Usuário Consulta Demo', email: 'consulta@frotamax.local', perfil: 'visualizador' },
];

const VEICULOS = [
  ['FM-001', 'ABC1D23', 'Toyota', 'Corolla', 2023, 'sedan', 'Unidade Matriz', 62350, 'pool', 'disponivel'],
  ['FM-002', 'BRA2E19', 'Fiat', 'Strada', 2022, 'picape', 'Unidade Operacional', 24180, 'atribuido', 'em_uso'],
  ['FM-003', 'QWE3R45', 'Volkswagen', 'T-Cross', 2024, 'suv', 'Unidade Comercial', 38920, 'pool', 'disponivel'],
  ['FM-004', 'RTY4U56', 'Renault', 'Kwid', 2021, 'hatch', 'Unidade Operacional', 19560, 'pool', 'manutencao'],
  ['FM-005', 'UIO5P67', 'Chevrolet', 'Onix', 2023, 'hatch', 'Unidade Matriz', 45210, 'pool', 'em_uso'],
  ['FM-006', 'ASD6F78', 'Nissan', 'Frontier', 2022, 'picape', 'Unidade Operacional', 72430, 'atribuido', 'disponivel'],
  ['FM-007', 'GHJ7K89', 'Fiat', 'Fiorino', 2020, 'utilitario', 'Unidade Matriz', 98110, 'pool', 'indisponivel'],
  ['FM-008', 'ZXC8V90', 'Hyundai', 'HB20', 2024, 'hatch', 'Unidade Comercial', 8740, 'pool', 'disponivel'],
] as const;

// [nome, matrícula, categoria da CNH, dias até o vencimento da CNH, telefone, liberado para o POOL]
const CONDUTORES = [
  ['Ana Paula Ribeiro', 'M-1001', 'B', 730, '(62) 90000-0001', true],
  ['Carlos Eduardo Matos', 'M-1002', 'AB', 400, '(62) 90000-0002', true],
  ['Juliana Ferreira Lima', 'M-1003', 'B', 20, '(62) 90000-0003', true],
  ['Rafael Souza Prado', 'M-1004', 'D', -10, '(62) 90000-0004', true],
  ['Lucas Henrique Alves', 'M-1005', 'B', 1000, '(62) 90000-0005', false],
  ['Patrícia Gomes Rocha', 'M-1006', 'AB', 540, '(62) 90000-0006', true],
] as const;

// [tipo, placa do veículo, matrícula do condutor, início, previsão de devolução, finalidade]
// Início e fim são deslocamentos a partir de hoje (00h, horário de Brasília); "agora" = empréstimo em andamento.
const RESERVAS = [
  ['emprestimo', 'UIO5P67', 'M-1002', 'agora', 'agora', 'Visita técnica à Unidade Operacional'],
  ['reserva', 'ABC1D23', 'M-1001', '1 day 8 hours', '1 day 17 hours', 'Reunião com fornecedor em Goiânia'],
  ['reserva', 'QWE3R45', 'M-1006', '3 days 7 hours 30 minutes', '3 days 12 hours', 'Entrega de documentos na Unidade Comercial'],
] as const;

// Movimentações já encerradas, para que o histórico de utilização (Sprint 03) tenha exemplos.
// [tipo, placa, matrícula, dias atrás, horas previstas, horas reais, km percorridos, finalidade, observação da devolução, situação]
const HISTORICO = [
  ['emprestimo', 'ABC1D23', 'M-1003', 3, 5, 5, 58, 'Coleta de amostras no laboratório', 'Pneu dianteiro com pressão baixa; calibrado na chegada.', 'concluida'],
  ['reserva', 'ZXC8V90', 'M-1006', 5, 4, 0, 0, 'Entrega de malotes', 'Visita remarcada pela unidade.', 'cancelada'],
  ['reserva', 'QWE3R45', 'M-1001', 9, 6, 6, 74, 'Treinamento na Unidade Comercial', null, 'concluida'],
  ['emprestimo', 'ABC1D23', 'M-1002', 12, 8, 9, 186, 'Visita a cliente em Goiânia', 'Sem ocorrências.', 'concluida'],
] as const;

export async function seed() {
  const senha = process.env.SEED_SENHA;
  if (!senha || senha.length < 8) {
    throw new Error('Defina SEED_SENHA no arquivo .env (mínimo de 8 caracteres) para criar os usuários de demonstração.');
  }
  const hash = await bcrypt.hash(senha, 12);

  for (const u of USUARIOS) {
    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (LOWER(email)) DO NOTHING`,
      [u.nome, u.email, hash, u.perfil]
    );
  }

  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM usuarios WHERE email = 'gestor@frotamax.local'`);
  const gestorId = rows[0]?.id ?? null;

  for (const v of VEICULOS) {
    await pool.query(
      `INSERT INTO veiculos (codigo, placa, marca, modelo, ano_modelo, tipo, unidade, quilometragem, modalidade, situacao, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       ON CONFLICT (placa) DO NOTHING`,
      [...v, gestorId]
    );
  }

  // Condutores fictícios: validade da CNH relativa à data de hoje, para exibir as três situações
  for (const [nome, matricula, categoria, diasValidade, telefone, liberado] of CONDUTORES) {
    await pool.query(
      `INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, telefone, liberado_pool, criado_por, atualizado_por)
       VALUES ($1, $2, $3, CURRENT_DATE + $4::int, $5, $6, $7, $7)
       ON CONFLICT ((UPPER(matricula))) DO NOTHING`,
      [nome, matricula, categoria, diasValidade, telefone, liberado, gestorId]
    );
  }

  // Reservas e empréstimo fictícios, criados apenas quando ainda não há nenhum registro
  const { rows: existentes } = await pool.query<{ total: string }>('SELECT COUNT(*) AS total FROM reservas');
  if (Number(existentes[0].total) === 0) {
    const hoje = `date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')`;
    const local = (expr: string) => `((${expr}) AT TIME ZONE 'America/Sao_Paulo')`;
    for (const [tipo, placa, matricula, inicio, fim, finalidade] of RESERVAS) {
      const inicioSql = inicio === 'agora' ? `NOW() - INTERVAL '2 hours'` : local(`${hoje} + INTERVAL '${inicio}'`);
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO reservas (tipo, veiculo_id, condutor_id, inicio, fim_previsto, retirada_em, km_retirada, finalidade, status, criado_por, atualizado_por)
         SELECT $1::varchar, v.id, c.id, ${inicioSql}, ${fim === 'agora' ? `NOW() + INTERVAL '6 hours'` : local(`${hoje} + INTERVAL '${fim}'`)},
                CASE WHEN $1::varchar = 'emprestimo' THEN ${inicioSql} END,
                CASE WHEN $1::varchar = 'emprestimo' THEN v.quilometragem END, $4,
                CASE WHEN $1::varchar = 'emprestimo' THEN 'em_uso' ELSE 'agendada' END, $5, $5
           FROM veiculos v, condutores c
          WHERE v.placa = $2 AND UPPER(c.matricula) = $3
         RETURNING id`,
        [tipo, placa, matricula, finalidade, gestorId]
      );
      if (rows[0]) {
        await pool.query(
          `INSERT INTO reserva_eventos (reserva_id, evento, usuario_id, observacao) VALUES ($1, 'registro', $2, 'Registro de demonstração.')`,
          [rows[0].id, gestorId]
        );
        if (tipo === 'emprestimo') {
          await pool.query(`INSERT INTO reserva_eventos (reserva_id, evento, usuario_id) VALUES ($1, 'retirada', $2)`, [rows[0].id, gestorId]);
          // O veículo emprestado fica "em uso", coerente com o empréstimo em andamento
          await pool.query(`UPDATE veiculos SET situacao = 'em_uso' WHERE placa = $1`, [placa]);
        }
      }
    }
  }

  // Histórico fictício, inserido uma única vez (quando ainda não há nenhuma devolução registrada).
  // A quilometragem é calculada de trás para frente a partir da atual de cada veículo, para ficar coerente.
  const { rows: encerradas } = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM reservas WHERE status = 'concluida'`
  );
  if (Number(encerradas[0].total) === 0) {
    const kmAtual = new Map<string, number>();
    for (const [tipo, placa, matricula, diasAtras, horasPrevistas, horasReais, kmPercorridos, finalidade, observacao, situacao] of HISTORICO) {
      const { rows: vs } = await pool.query<{ quilometragem: number }>('SELECT quilometragem FROM veiculos WHERE placa = $1', [placa]);
      if (!vs[0]) continue;
      const kmDevolucao = kmAtual.get(placa) ?? vs[0].quilometragem;
      const kmRetirada = kmDevolucao - kmPercorridos;
      if (situacao === 'concluida') kmAtual.set(placa, kmRetirada - 35);
      const inicio = `(date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '${diasAtras} days' + INTERVAL '8 hours') AT TIME ZONE 'America/Sao_Paulo'`;
      const concluida = situacao === 'concluida';
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO reservas (tipo, veiculo_id, condutor_id, inicio, fim_previsto, retirada_em, devolvida_em, km_retirada,
                               km_devolucao, observacao_devolucao, finalidade, status, motivo_cancelamento,
                               criado_por, atualizado_por, devolvida_por)
         SELECT $1::varchar, v.id, c.id, ${inicio}, ${inicio} + make_interval(hours => $4::int),
                CASE WHEN $5::boolean THEN ${inicio} END,
                CASE WHEN $5::boolean THEN ${inicio} + make_interval(hours => $6::int) END,
                CASE WHEN $5::boolean THEN $7::int END, CASE WHEN $5::boolean THEN $8::int END,
                CASE WHEN $5::boolean THEN $9::varchar END, $10, $11::varchar,
                CASE WHEN $5::boolean THEN NULL ELSE $9::varchar END, $12, $12, CASE WHEN $5::boolean THEN $12::uuid END
           FROM veiculos v, condutores c
          WHERE v.placa = $2 AND UPPER(c.matricula) = $3
         RETURNING id`,
        [tipo, placa, matricula, horasPrevistas, concluida, horasReais, kmRetirada, kmDevolucao, observacao,
          finalidade, situacao, gestorId]
      );
      if (!rows[0]) continue;
      const eventos: [string, string | null, string][] = [['registro', 'Registro de demonstração.', '0 hours']];
      if (concluida) {
        eventos.push(['retirada', null, '0 hours']);
        eventos.push(['devolucao', `Devolução com ${kmDevolucao.toLocaleString('pt-BR')} km.${observacao ? ` ${observacao}` : ''}`, `${horasReais} hours`]);
      } else {
        eventos.push(['cancelamento', observacao, '0 hours']);
      }
      for (const [evento, texto, deslocamento] of eventos) {
        await pool.query(
          `INSERT INTO reserva_eventos (reserva_id, evento, usuario_id, observacao, criado_em)
           VALUES ($1, $2, $3, $4, ${inicio} + INTERVAL '${deslocamento}')`,
          [rows[0].id, evento, gestorId, texto]
        );
      }
    }
  }

  console.log(`Dados fictícios carregados: ${USUARIOS.length} usuários, ${VEICULOS.length} veículos, `
    + `${CONDUTORES.length} condutores, ${RESERVAS.length} reservas/empréstimos em aberto e `
    + `${HISTORICO.length} movimentações encerradas.`);
  console.log('Usuários de demonstração: admin@frotamax.local, gestor@frotamax.local, consulta@frotamax.local (senha definida em SEED_SENHA).');
}

if (require.main === module) {
  runMigrations()
    .then(seed)
    .then(() => pool.end())
    .catch((error) => {
      console.error('Falha ao carregar dados de demonstração:', error.message);
      process.exit(1);
    });
}
