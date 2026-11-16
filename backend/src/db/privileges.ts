/**
 * 1.7 (S6): the running app must not be a superuser or own the schema — a bug or injection could then drop tables,
 * read the append-only logs' internals, or turn off the triggers that keep them append-only.
 * Production refuses to start unless DATABASE_URL logs in as a member of cover_check_app (see deploy/db-roles.sql).
 */
import type { Queryable } from './pool.js';

export async function leastPrivilegeProblems(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ usr: string; superuser: boolean; owns_schema: boolean; is_app: boolean }>(`
    SELECT current_user AS usr,
           r.rolsuper AS superuser,
           EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = 'cover_check' AND pg_has_role(current_user, n.nspowner, 'MEMBER')) AS owns_schema,
           pg_has_role(current_user, 'cover_check_app', 'MEMBER') AS is_app
    FROM pg_roles r WHERE r.rolname = current_user`);
  const r = rows[0];
  if (!r) return ['Could not read the database role of DATABASE_URL.'];
  const p: string[] = [];
  if (r.superuser) p.push(`DATABASE_URL logs in as superuser "${r.usr}" — use a login that is only a member of cover_check_app.`);
  if (r.owns_schema) p.push(`DATABASE_URL login "${r.usr}" owns the cover_check schema — keep that for MIGRATION_DATABASE_URL only.`);
  if (!r.is_app) p.push(`DATABASE_URL login "${r.usr}" is not a member of cover_check_app.`);
  return p;
}
