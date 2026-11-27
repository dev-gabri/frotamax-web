-- Frota Max Web — estrutura da Sprint 02
-- Entidades: condutores, reservas/empréstimos de veículos e o registro dos eventos de cada movimentação.
-- Regras combinadas com o Departamento de Frotas:
--   * as reservas e os empréstimos são registrados pelo próprio Departamento de Frotas;
--   * somente veículos POOL podem ser reservados ou emprestados (veículos de uso atribuído ficam de fora);
--   * somente condutores ativos e liberados pelo Departamento de Frotas para o POOL podem receber veículos;
--   * condutor com CNH vencida não pode receber veículo;
--   * da CNH são guardadas apenas a categoria e a validade (minimização de dados pessoais).

-- Condutores que podem ser relacionados às reservas e empréstimos.
CREATE TABLE condutores (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome           VARCHAR(120) NOT NULL,
    matricula      VARCHAR(20)  NOT NULL,
    cnh_categoria  VARCHAR(2)   NOT NULL CHECK (cnh_categoria IN ('A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE')),
    cnh_validade   DATE         NOT NULL,
    telefone       VARCHAR(20),
    liberado_pool  BOOLEAN      NOT NULL DEFAULT FALSE,
    ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
    observacoes    VARCHAR(500),
    criado_por     UUID REFERENCES usuarios (id),
    atualizado_por UUID REFERENCES usuarios (id),
    criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX condutores_matricula_unica ON condutores (UPPER(matricula));

CREATE TRIGGER condutores_atualizado_em BEFORE UPDATE ON condutores
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- Reservas e empréstimos de veículos POOL.
--   tipo:   reserva (utilização futura) ou emprestimo (retirada no momento do registro)
--   status: agendada  -> reserva registrada, veículo ainda não retirado
--           em_uso    -> veículo retirado pelo condutor
--           cancelada -> reserva cancelada antes da retirada
--           concluida -> veículo devolvido (registro da devolução previsto para a Sprint 03)
--   inicio / fim_previsto: período reservado; usado na verificação de conflitos
CREATE SEQUENCE reservas_numero_seq START 1;

CREATE TABLE reservas (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero               INTEGER      NOT NULL DEFAULT nextval('reservas_numero_seq') UNIQUE,
    tipo                 VARCHAR(12)  NOT NULL CHECK (tipo IN ('reserva', 'emprestimo')),
    veiculo_id           UUID         NOT NULL REFERENCES veiculos (id),
    condutor_id          UUID         NOT NULL REFERENCES condutores (id),
    inicio               TIMESTAMPTZ  NOT NULL,
    fim_previsto         TIMESTAMPTZ  NOT NULL,
    retirada_em          TIMESTAMPTZ,
    devolvida_em         TIMESTAMPTZ,
    finalidade           VARCHAR(200) NOT NULL,
    observacoes          VARCHAR(500),
    status               VARCHAR(12)  NOT NULL CHECK (status IN ('agendada', 'em_uso', 'cancelada', 'concluida')),
    motivo_cancelamento  VARCHAR(300),
    criado_por           UUID REFERENCES usuarios (id),
    atualizado_por       UUID REFERENCES usuarios (id),
    criado_em            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT reservas_periodo_valido CHECK (fim_previsto > inicio),
    CONSTRAINT reservas_cancelamento_motivo CHECK (status <> 'cancelada' OR motivo_cancelamento IS NOT NULL),
    CONSTRAINT reservas_retirada_registrada CHECK (status NOT IN ('em_uso', 'concluida') OR retirada_em IS NOT NULL)
);

ALTER SEQUENCE reservas_numero_seq OWNED BY reservas.numero;

CREATE INDEX reservas_veiculo_periodo_idx ON reservas (veiculo_id, inicio, fim_previsto)
    WHERE status IN ('agendada', 'em_uso');
CREATE INDEX reservas_condutor_idx ON reservas (condutor_id);
CREATE INDEX reservas_status_idx ON reservas (status);

CREATE TRIGGER reservas_atualizado_em BEFORE UPDATE ON reservas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- Eventos de cada reserva ou empréstimo (rastreabilidade: quem fez o quê e quando).
CREATE TABLE reserva_eventos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserva_id  UUID         NOT NULL REFERENCES reservas (id),
    evento      VARCHAR(20)  NOT NULL CHECK (evento IN ('registro', 'retirada', 'cancelamento', 'devolucao')),
    usuario_id  UUID REFERENCES usuarios (id),
    observacao  VARCHAR(300),
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX reserva_eventos_reserva_idx ON reserva_eventos (reserva_id, criado_em);
