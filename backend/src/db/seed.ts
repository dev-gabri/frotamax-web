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

  console.log(`Dados fictícios carregados: ${USUARIOS.length} usuários e ${VEICULOS.length} veículos.`);
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
