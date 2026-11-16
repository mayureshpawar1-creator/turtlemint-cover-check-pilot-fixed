-- Database logins for Cover Check (roadmap 1.7, issue S6). Run ONCE per environment as an admin, AFTER the first
-- `npm run db:migrate` (migration 002 creates the NOLOGIN group roles used below). Replace every <...> first;
-- keep the passwords in the secrets manager, never in the repo.
--
--   cc_migrate  owns the schema; used only by db:migrate             → MIGRATION_DATABASE_URL
--   cc_app      the running API: read/write, no DDL, no superuser     → DATABASE_URL
--   cc_agent    caller tooling, if it ever connects directly           (optional)
--   cc_bi       read-only reporting (Superset/Metabase)                (optional)

CREATE ROLE cc_migrate LOGIN PASSWORD '<migrate-password>';
CREATE ROLE cc_app     LOGIN PASSWORD '<app-password>'   IN ROLE cover_check_app;
CREATE ROLE cc_bi      LOGIN PASSWORD '<bi-password>'    IN ROLE cover_check_bi;

-- Hand the schema and its objects to the migration login (run as their current owner).
ALTER SCHEMA cover_check OWNER TO cc_migrate;
-- REASSIGN OWNED BY <current-owner> TO cc_migrate;   -- if the schema was created by another login

-- Objects created by future migrations are usable by the app without each migration remembering a GRANT.
ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA cover_check GRANT SELECT, INSERT, UPDATE ON TABLES TO cover_check_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA cover_check GRANT USAGE ON SEQUENCES TO cover_check_app;
ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA cover_check GRANT SELECT ON TABLES TO cover_check_bi;

-- Check: the API refuses to start in production unless DATABASE_URL is a member of cover_check_app, not a superuser
-- and not the schema owner (backend/src/db/privileges.ts).
