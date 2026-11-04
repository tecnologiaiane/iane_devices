-- ==============================================================================
-- db/security.sql
-- Scripts de segurança para o PostgreSQL do IANE - Gestão de Dispositivos
-- Uso: docker compose exec -T postgres-test psql -U iane_admin -d telecom_assets_test -f /docker-entrypoint-initdb.d/security.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Papel de aplicação com privilégios mínimos (princípio do menor privilégio)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iane_app') THEN
    CREATE ROLE iane_app LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      INHERIT
      CONNECTION LIMIT 50
      PASSWORD '${IANE_APP_PASSWORD:-IaneApp@2026!}';
  END IF;
END
$$;

-- Revoga todos os privilégios padrão (public schema) antes de conceder os específicos
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Concede apenas SELECT/INSERT/UPDATE/DELETE nas tabelas do aplicativo
GRANT USAGE ON SCHEMA public TO iane_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE collaborators TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE phone_lines TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE devices TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE movements TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE terms_documents TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_users TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_logs TO iane_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_catalogs TO iane_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iane_app;

-- ------------------------------------------------------------------------------
-- 2. CHECK constraints para limitar o tamanho da coluna JSONB "data"
--    (previne DoS por payload JSONB excessivamente grande)
-- ------------------------------------------------------------------------------
ALTER TABLE collaborators   ADD CONSTRAINT chk_collaborators_data_size  CHECK (pg_column_size(data) < 65536);
ALTER TABLE phone_lines     ADD CONSTRAINT chk_phone_lines_data_size    CHECK (pg_column_size(data) < 65536);
ALTER TABLE devices         ADD CONSTRAINT chk_devices_data_size        CHECK (pg_column_size(data) < 65536);
ALTER TABLE movements       ADD CONSTRAINT chk_movements_data_size      CHECK (pg_column_size(data) < 65536);
ALTER TABLE terms_documents ADD CONSTRAINT chk_terms_data_size          CHECK (pg_column_size(data) < 65536);

-- ------------------------------------------------------------------------------
-- 3. Revogar privilégios perigosos do papel público e de superusuários legados
-- ------------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE telecom_assets_test FROM PUBLIC;
GRANT CONNECT ON DATABASE telecom_assets_test TO iane_app;

-- Impede que iane_app crie extensões ou objetos no schema public
REVOKE ALL ON SCHEMA public FROM iane_app;
GRANT USAGE ON SCHEMA public TO iane_app;

-- ------------------------------------------------------------------------------
-- 4. Comentário de documentação
-- ------------------------------------------------------------------------------
COMMENT ON ROLE iane_app IS 'Papel de aplicação com privilégios mínimos: apenas SELECT/INSERT/UPDATE/DELETE nas tabelas do app. Sem superuser, createdb, createrole, CREATE na schema public, nem extensões.';
