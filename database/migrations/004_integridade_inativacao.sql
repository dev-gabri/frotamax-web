-- Frota Max Web — integridade, histórico e inativação (Sprint 04)
-- Regras:
--   * veículos e condutores que deixam de ser utilizados são inativados, nunca excluídos,
--     para que o histórico de reservas, empréstimos e devoluções continue consultável;
--   * a inativação registra quando, por quem e por quê; a reativação limpa esses campos
--     (os campos descrevem a inativação em vigor);
--   * o banco recusa a exclusão de usuários, veículos, condutores, movimentações e eventos;
--   * o registro de eventos das movimentações só recebe novas linhas.

ALTER TABLE veiculos
    ADD COLUMN inativado_em      TIMESTAMPTZ,
    ADD COLUMN inativado_por     UUID REFERENCES usuarios (id),
    ADD COLUMN motivo_inativacao VARCHAR(300);

ALTER TABLE condutores
    ADD COLUMN inativado_em      TIMESTAMPTZ,
    ADD COLUMN inativado_por     UUID REFERENCES usuarios (id),
    ADD COLUMN motivo_inativacao VARCHAR(300);

-- Cadastros que já estavam inativos antes desta versão
UPDATE veiculos   SET inativado_em = atualizado_em WHERE ativo = FALSE AND inativado_em IS NULL;
UPDATE condutores SET inativado_em = atualizado_em WHERE ativo = FALSE AND inativado_em IS NULL;

ALTER TABLE veiculos
    ADD CONSTRAINT veiculos_inativacao_coerente CHECK (ativo = (inativado_em IS NULL));
ALTER TABLE condutores
    ADD CONSTRAINT condutores_inativacao_coerente CHECK (ativo = (inativado_em IS NULL));

-- Data da inativação definida pelo próprio banco, qualquer que seja a operação que altere "ativo"
CREATE OR REPLACE FUNCTION registrar_inativacao() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
        IF NEW.ativo THEN
            NEW.inativado_em := NULL;
            NEW.inativado_por := NULL;
            NEW.motivo_inativacao := NULL;
        ELSE
            NEW.inativado_em := NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER veiculos_inativacao BEFORE UPDATE OF ativo ON veiculos
    FOR EACH ROW EXECUTE FUNCTION registrar_inativacao();
CREATE TRIGGER condutores_inativacao BEFORE UPDATE OF ativo ON condutores
    FOR EACH ROW EXECUTE FUNCTION registrar_inativacao();

-- Exclusão bloqueada: o histórico não pode ser apagado
CREATE OR REPLACE FUNCTION impedir_exclusao() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registros de % não podem ser excluídos; utilize a inativação para preservar o histórico.', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuarios_sem_exclusao        BEFORE DELETE ON usuarios        FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
CREATE TRIGGER veiculos_sem_exclusao        BEFORE DELETE ON veiculos        FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
CREATE TRIGGER condutores_sem_exclusao      BEFORE DELETE ON condutores      FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
CREATE TRIGGER reservas_sem_exclusao        BEFORE DELETE ON reservas        FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
CREATE TRIGGER reserva_eventos_sem_exclusao BEFORE DELETE ON reserva_eventos FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();

-- Eventos das movimentações: somente inclusão
CREATE OR REPLACE FUNCTION impedir_alteracao_evento() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'O registro de eventos das movimentações não pode ser alterado.'
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reserva_eventos_somente_inclusao BEFORE UPDATE ON reserva_eventos
    FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_evento();

-- Consulta dos cadastros inativos (recuperação)
CREATE INDEX veiculos_ativo_idx   ON veiculos (ativo);
CREATE INDEX condutores_ativo_idx ON condutores (ativo);
