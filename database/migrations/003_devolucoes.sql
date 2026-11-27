-- Frota Max Web — devolução de veículos (Sprint 03)
-- Regras combinadas com o Departamento de Frotas:
--   * na devolução são registrados a data e a hora, a quilometragem de chegada e uma observação;
--   * a quilometragem de chegada atualiza a do veículo e não pode ser menor que a registrada;
--   * se o veículo voltar com problema, o Departamento de Frotas pode enviá-lo para manutenção
--     no próprio registro da devolução.
-- A quilometragem na retirada é copiada do veículo automaticamente, para que o histórico mostre
-- quantos quilômetros foram percorridos em cada utilização.

ALTER TABLE reservas
    ADD COLUMN km_retirada          INTEGER CHECK (km_retirada >= 0),
    ADD COLUMN km_devolucao         INTEGER CHECK (km_devolucao >= 0),
    ADD COLUMN observacao_devolucao VARCHAR(500),
    ADD COLUMN enviado_manutencao   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN devolvida_por        UUID REFERENCES usuarios (id),
    ADD CONSTRAINT reservas_km_coerente
        CHECK (km_devolucao IS NULL OR km_retirada IS NULL OR km_devolucao >= km_retirada),
    ADD CONSTRAINT reservas_devolucao_registrada
        CHECK (status <> 'concluida' OR (devolvida_em IS NOT NULL AND km_devolucao IS NOT NULL)),
    ADD CONSTRAINT reservas_devolucao_apos_retirada
        CHECK (devolvida_em IS NULL OR devolvida_em >= retirada_em);

-- Empréstimos que já estavam em andamento antes desta versão: a quilometragem na retirada
-- passa a ser a registrada no veículo neste momento.
UPDATE reservas r
   SET km_retirada = v.quilometragem
  FROM veiculos v
 WHERE v.id = r.veiculo_id AND r.status = 'em_uso' AND r.km_retirada IS NULL;

-- Consultas de histórico por veículo e por condutor, das mais recentes para as mais antigas.
CREATE INDEX reservas_veiculo_historico_idx ON reservas (veiculo_id, inicio DESC);
CREATE INDEX reservas_condutor_historico_idx ON reservas (condutor_id, inicio DESC);
