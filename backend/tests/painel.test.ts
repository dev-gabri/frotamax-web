import request from 'supertest';
import { pool } from '../src/db/pool';
import { app, encerrar, prepararBanco, token } from './helpers';

let gestor: string;
let consulta: string;
const ids: Record<string, string> = {};

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const HORA = 3_600_000;
const emHoras = (h: number) => new Date(Date.now() + h * HORA).toISOString();
const dia = (deslocamento: number) => {
  const d = new Date(Date.now() + deslocamento * 24 * HORA);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

beforeAll(async () => {
  await prepararBanco();
  gestor = await token('gestor');
  consulta = await token('consulta');
  await pool.query(
    `INSERT INTO veiculos (codigo, placa, marca, modelo, tipo, unidade, quilometragem, modalidade, situacao) VALUES
      ('P-001', 'NNN1N11', 'Fiat', 'Uno', 'hatch', 'Unidade A', 10000, 'pool', 'disponivel'),
      ('P-002', 'PPP2P22', 'Fiat', 'Toro', 'picape', 'Unidade A', 20000, 'pool', 'disponivel'),
      ('P-003', 'QQQ3Q33', 'VW', 'Gol', 'hatch', 'Unidade B', 30000, 'pool', 'disponivel')`
  );
  const { rows: v } = await pool.query<{ id: string; codigo: string }>('SELECT id, codigo FROM veiculos');
  for (const r of v) ids[r.codigo] = r.id;
  await pool.query(
    `INSERT INTO condutores (nome, matricula, cnh_categoria, cnh_validade, liberado_pool) VALUES ('Condutora Painel', 'P-1', 'B', $1, TRUE)`,
    [dia(365)]
  );
  ids['P-1'] = (await pool.query<{ id: string }>(`SELECT id FROM condutores WHERE matricula = 'P-1'`)).rows[0].id;
});
afterAll(encerrar);

const registrar = (corpo: Record<string, unknown>) => request(app).post('/api/reservas').set(auth(gestor)).send({
  condutor_id: ids['P-1'], finalidade: 'Teste dos indicadores', ...corpo,
});

describe('Tela inicial — indicadores e filtros de prazo (Sprint 04)', () => {
  test('CT71 — os filtros de prazo listam exatamente as movimentações contadas nos indicadores', async () => {
    // Empréstimo com a devolução prevista já vencida (atrasado)
    const atrasado = await registrar({ tipo: 'emprestimo', veiculo_id: ids['P-001'], fim_previsto: emHoras(2) });
    await pool.query(
      `UPDATE reservas SET inicio = NOW() - INTERVAL '5 hours', retirada_em = NOW() - INTERVAL '5 hours',
                           fim_previsto = NOW() - INTERVAL '1 hour' WHERE id = $1`, [atrasado.body.data.id]
    );
    // Empréstimo em uso dentro do prazo
    await registrar({ tipo: 'emprestimo', veiculo_id: ids['P-002'], fim_previsto: emHoras(3) });
    // Reserva com retirada prevista para hoje (01h do dia, horário local) e outra para daqui a 3 dias
    const hoje = await registrar({ tipo: 'reserva', veiculo_id: ids['P-003'], inicio: emHoras(2), fim_previsto: emHoras(5) });
    await pool.query(
      `UPDATE reservas SET inicio = ((NOW() AT TIME ZONE 'America/Sao_Paulo')::date + TIME '01:00') AT TIME ZONE 'America/Sao_Paulo'
        WHERE id = $1`, [hoje.body.data.id]
    );
    await registrar({ tipo: 'reserva', veiculo_id: ids['P-003'], inicio: emHoras(72), fim_previsto: emHoras(75) });

    const resumo = (await request(app).get('/api/reservas/resumo').set(auth(consulta))).body.data;
    expect(resumo).toEqual({ agendadas: 2, em_uso: 2, atrasadas: 1, retiradas_hoje: 1 });

    const atrasadas = await request(app).get('/api/reservas').query({ prazo: 'atrasadas' }).set(auth(consulta));
    expect(atrasadas.body.data.map((r: { id: string }) => r.id)).toEqual([atrasado.body.data.id]);
    expect(atrasadas.body.meta.total).toBe(resumo.atrasadas);
    const retiradas = await request(app).get('/api/reservas').query({ prazo: 'retiradas_hoje' }).set(auth(consulta));
    expect(retiradas.body.data.map((r: { id: string }) => r.id)).toEqual([hoje.body.data.id]);
    expect(retiradas.body.meta.total).toBe(resumo.retiradas_hoje);

    const invalido = await request(app).get('/api/reservas').query({ prazo: 'semana' }).set(auth(consulta));
    expect(invalido.status).toBe(400);
  });

  test('CT72 — indicadores de veículos e condutores somam apenas os cadastros ativos', async () => {
    await request(app).patch(`/api/veiculos/${ids['T-001']}/inativacao`).set(auth(gestor)).send({ motivo: 'Teste do painel.' });
    const v = (await request(app).get('/api/veiculos/resumo').set(auth(consulta))).body.data;
    expect(v.total).toBe(v.disponivel + v.em_uso + v.manutencao + v.indisponivel);
    expect(v.total).toBe(4); // T-002, P-001, P-002 e P-003
    const ativos = (await request(app).get('/api/veiculos').set(auth(consulta))).body.data;
    expect(ativos).toHaveLength(v.total);

    const c = (await request(app).get('/api/condutores/resumo').set(auth(consulta))).body.data;
    expect(c).toEqual({ total: 1, liberados_pool: 1, cnh_vencendo: 0, cnh_vencida: 0 });
  });
});
