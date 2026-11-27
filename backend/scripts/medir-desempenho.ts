/**
 * Medição do tempo de resposta das consultas com volume de teste (Sprint 04, RNF10/CA16).
 *
 * Usa SOMENTE o banco de testes (DATABASE_URL_TEST), que é recriado do zero, como nos testes automatizados.
 * Gera dados fictícios em volume maior que o de uso diário e mede cada consulta várias vezes pela própria
 * API (sem rede: requisições locais). O resultado vale para o computador em que a medição foi feita.
 *
 * Uso: npm --prefix backend run medir:desempenho
 */
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_ENV = 'test';

/* eslint-disable import/first */
import os from 'os';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { createApp } from '../src/app';

const VOLUME = { veiculos: 500, condutores: 1000, movimentacoesEncerradas: 30_000 };
const REPETICOES = 30;
const SENHA = 'Senha@Medicao123';

async function prepararVolume() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(false);
  const hash = await bcrypt.hash(SENHA, 4);
  await pool.query(`INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ('Medição', 'medicao@teste.local', $1, 'gestor_frota')`, [hash]);

  // Veículos: 80% POOL; placas únicas no padrão Mercosul
  await pool.query(`
    INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, quilometragem, modalidade, situacao)
    SELECT 'V-' || lpad(i::text, 4, '0'),
           'TS' || chr(65 + i / 100) || (i % 10)::text || chr(65 + (i / 10) % 10) || lpad((i % 100)::text, 2, '0'),
           'Marca ' || (i % 7), 'Modelo ' || (i % 23), (ARRAY['hatch','sedan','suv','picape','utilitario'])[1 + i % 5],
           'Unidade ' || (i % 6), 20000 + i * 10,
           CASE WHEN i % 5 = 0 THEN 'atribuido' ELSE 'pool' END,
           (ARRAY['disponivel','disponivel','disponivel','manutencao','indisponivel'])[1 + i % 5]
      FROM generate_series(1, $1) AS i`, [VOLUME.veiculos]);

  await pool.query(`
    INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, liberado_pool)
    SELECT 'Condutor Fictício ' || i, 'C-' || lpad(i::text, 5, '0'), 'B', CURRENT_DATE + (i % 900) - 30, i % 4 <> 0
      FROM generate_series(1, $1) AS i`, [VOLUME.condutores]);

  // Movimentações encerradas nos últimos 3 anos, distribuídas entre os veículos POOL e os condutores
  await pool.query(`
    WITH v AS (SELECT id, row_number() OVER (ORDER BY codigo) AS n FROM veiculos WHERE modalidade = 'pool'),
         c AS (SELECT id, row_number() OVER (ORDER BY matricula) AS n FROM condutores),
         nv AS (SELECT COUNT(*) AS total FROM v), nc AS (SELECT COUNT(*) AS total FROM c),
         m AS (SELECT k, NOW() - INTERVAL '3 years' + k * (INTERVAL '3 years' / $1) AS inicio FROM generate_series(1, $1) AS k)
    INSERT INTO reservas (tipo, veiculo_id, condutor_id, inicio, fim_previsto, retirada_em, devolvida_em,
                          km_retirada, km_devolucao, finalidade, status)
    SELECT 'emprestimo', v.id, c.id, m.inicio, m.inicio + INTERVAL '4 hours', m.inicio,
           m.inicio + INTERVAL '4 hours' + (m.k % 3) * INTERVAL '1 hour', 10000 + m.k, 10000 + m.k + 40 + m.k % 90,
           'Movimentação fictícia para medição', 'concluida'
      FROM m CROSS JOIN nv CROSS JOIN nc
      JOIN v ON v.n = 1 + m.k % nv.total
      JOIN c ON c.n = 1 + m.k % nc.total`, [VOLUME.movimentacoesEncerradas]);

  await pool.query(`
    INSERT INTO reserva_eventos (reserva_id, evento, criado_em)
    SELECT r.id, e.evento, CASE e.evento WHEN 'devolucao' THEN r.devolvida_em ELSE r.inicio END
      FROM reservas r CROSS JOIN (VALUES ('registro'), ('retirada'), ('devolucao')) AS e(evento)`);
  await pool.query('ANALYZE');
}

async function medir(nome: string, chamada: () => Promise<request.Response>) {
  const tempos: number[] = [];
  let status = 0;
  for (let i = 0; i < REPETICOES; i++) {
    const inicio = process.hrtime.bigint();
    const res = await chamada();
    tempos.push(Number(process.hrtime.bigint() - inicio) / 1e6);
    status = res.status;
  }
  tempos.sort((a, b) => a - b);
  const mediana = tempos[Math.floor(tempos.length / 2)];
  const p95 = tempos[Math.ceil(tempos.length * 0.95) - 1];
  return { nome, status, mediana, p95, maximo: tempos[tempos.length - 1] };
}

async function principal() {
  const inicioPreparo = Date.now();
  await prepararVolume();
  const app = createApp();
  const login = await request(app).post('/api/auth/login').send({ email: 'medicao@teste.local', senha: SENHA });
  const A = { Authorization: `Bearer ${login.body.data.token}` };
  const { rows: [v] } = await pool.query(`SELECT id FROM veiculos WHERE modalidade = 'pool' ORDER BY codigo LIMIT 1`);
  const { rows: [c] } = await pool.query(`SELECT id FROM condutores ORDER BY matricula LIMIT 1`);
  const { rows: [t] } = await pool.query(`SELECT (SELECT COUNT(*) FROM reservas) AS reservas, (SELECT COUNT(*) FROM reserva_eventos) AS eventos`);
  const amanha = new Date(Date.now() + 86_400_000).toISOString();
  const depois = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const mes = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);

  const get = (url: string) => () => request(app).get(url).set(A);
  const resultados = [
    await medir('Lista de veículos ativos (todos)', get('/api/veiculos')),
    await medir('Lista de veículos com busca', get('/api/veiculos?busca=Modelo%201')),
    await medir('Resumo de veículos', get('/api/veiculos/resumo')),
    await medir('Lista de condutores ativos (todos)', get('/api/condutores')),
    await medir('Resumo de condutores', get('/api/condutores/resumo')),
    await medir('Movimentações: 1ª página (25)', get('/api/reservas?por_pagina=25')),
    await medir('Movimentações: período de 30 dias', get(`/api/reservas?de=${mes}&ate=${hoje}&por_pagina=25`)),
    await medir('Movimentações: busca por placa', get('/api/reservas?busca=TSA&por_pagina=25')),
    await medir('Movimentações: devoluções atrasadas', get('/api/reservas?prazo=atrasadas&por_pagina=5')),
    await medir('Resumo das movimentações', get('/api/reservas/resumo')),
    await medir('Disponibilidade para reserva', get(`/api/reservas/disponibilidade?tipo=reserva&inicio=${amanha}&fim=${depois}`)),
    await medir('Histórico de um veículo (1ª página)', get(`/api/veiculos/${v.id}/historico`)),
    await medir('Histórico de um condutor (1ª página)', get(`/api/condutores/${c.id}/historico`)),
  ];

  const ms = (n: number) => n.toFixed(1).replace('.', ',');
  console.log(`\nMedição de desempenho — ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log(`Ambiente: ${os.type()} ${os.release()}, ${os.cpus()[0]?.model} (${os.cpus().length} núcleos), Node.js ${process.version}`);
  console.log(`Volume: ${VOLUME.veiculos} veículos, ${VOLUME.condutores} condutores, ${t.reservas} movimentações e ${t.eventos} eventos`
    + ` (preparado em ${Math.round((Date.now() - inicioPreparo) / 1000)} s). ${REPETICOES} repetições por consulta.\n`);
  console.log('| Consulta | Status | Mediana (ms) | 95% até (ms) | Máximo (ms) |');
  console.log('|---|:---:|---:|---:|---:|');
  for (const r of resultados) console.log(`| ${r.nome} | ${r.status} | ${ms(r.mediana)} | ${ms(r.p95)} | ${ms(r.maximo)} |`);
  await pool.end();
}

principal().catch(async (erro) => {
  console.error('Falha na medição:', (erro as Error).message);
  await pool.end();
  process.exit(1);
});
