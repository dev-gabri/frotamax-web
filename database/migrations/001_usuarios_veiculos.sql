-- Frota Max Web — estrutura mínima da Sprint 01 (card S1-02)
-- Entidades: usuarios (acesso à aplicação) e veiculos (frota).
-- Somente o back-end acessa estas tabelas. Os dados utilizados em desenvolvimento são fictícios.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Usuários autorizados a acessar o módulo Web.
-- Perfis mínimos do MVP:
--   admin         -> administração da aplicação
--   gestor_frota  -> cadastra e atualiza informações da frota
--   visualizador  -> somente consulta
CREATE TABLE usuarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) NOT NULL,
    senha_hash    VARCHAR(100) NOT NULL,
    perfil        VARCHAR(20)  NOT NULL CHECK (perfil IN ('admin', 'gestor_frota', 'visualizador')),
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acesso TIMESTAMPTZ,
    criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- E-mail único sem diferenciar maiúsculas e minúsculas
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (LOWER(email));

-- Veículos da frota.
--   modalidade: pool (uso compartilhado, sujeito a reserva) ou atribuido (uso vinculado a um colaborador)
--   situacao:   situação operacional atual, que define a disponibilidade do veículo
CREATE TABLE veiculos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo         VARCHAR(20)  NOT NULL,
    placa          VARCHAR(7)   NOT NULL,
    marca          VARCHAR(60)  NOT NULL,
    modelo         VARCHAR(80)  NOT NULL,
    ano_modelo     SMALLINT     CHECK (ano_modelo BETWEEN 1980 AND 2100),
    tipo           VARCHAR(20)  NOT NULL CHECK (tipo IN ('hatch', 'sedan', 'suv', 'picape', 'utilitario', 'caminhao', 'outro')),
    unidade        VARCHAR(80)  NOT NULL,
    quilometragem  INTEGER      NOT NULL DEFAULT 0 CHECK (quilometragem >= 0),
    modalidade     VARCHAR(20)  NOT NULL DEFAULT 'pool' CHECK (modalidade IN ('pool', 'atribuido')),
    situacao       VARCHAR(20)  NOT NULL DEFAULT 'disponivel' CHECK (situacao IN ('disponivel', 'em_uso', 'manutencao', 'indisponivel')),
    observacoes    VARCHAR(500),
    ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_por     UUID REFERENCES usuarios (id),
    atualizado_por UUID REFERENCES usuarios (id),
    criado_em      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT veiculos_placa_formato CHECK (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$')
);

CREATE UNIQUE INDEX veiculos_placa_unica  ON veiculos (placa);
CREATE UNIQUE INDEX veiculos_codigo_unico ON veiculos (UPPER(codigo));
CREATE INDEX veiculos_situacao_idx ON veiculos (situacao);

-- Atualiza automaticamente a coluna atualizado_em
CREATE OR REPLACE FUNCTION atualizar_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuarios_atualizado_em BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER veiculos_atualizado_em BEFORE UPDATE ON veiculos
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
