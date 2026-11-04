#!/bin/sh
set -e

# Cria/atualiza o usuário de aplicação com privilégios mínimos.
# A senha vem da variável de ambiente IANE_APP_PASSWORD (definida no .env).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iane_app') THEN
      CREATE ROLE iane_app LOGIN
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        INHERIT
        CONNECTION LIMIT 50
        PASSWORD '${IANE_APP_PASSWORD}';
    ELSE
      ALTER ROLE iane_app WITH PASSWORD '${IANE_APP_PASSWORD}';
    END IF;
  END
  $$;

  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

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
EOSQL
