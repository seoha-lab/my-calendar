# Daymo · Supabase Phase 1 verification — 2026-10-15

**Target:** Supabase project ref `qglwymsqskagoobpvcna` (Seoul), GitHub branch `feat/daymo-auth-cloud-foundation`.

## Verified (read-only project/SQL checks)
- Supabase project status: `ACTIVE_HEALTHY`.
- Ten public user-data tables exist; all ten have Row Level Security enabled.
- All ten tables: role `anon` has neither SELECT nor INSERT table privileges.
- Owner-managed tables (profiles, calendars, categories, shift_types, tasks,
  task_ranges, shift_assignments, user_preferences): authenticated role has
  SELECT/INSERT grants. Actual row access is limited by user-ID RLS policies.
- `sync_operations` and `backup_snapshots` only grant SELECT to authenticated
  clients (no client INSERT grant).
- RLS policy predicates for owner tables use `auth.uid()`, with both
  `USING` and `WITH CHECK` on UPDATE.
- The internal `daymo_create_user_defaults` and `rls_auto_enable`
  functions cannot be executed by `anon` or `authenticated`.
- Supabase Security Advisor: **no current security findings**.
- Both SQL migrations listed in Supabase migration history.
- Cloud account count: **0**; tasks/categories/shifts not yet migrated to
  cloud. This test did not create, modify, or delete user data.
- GitHub draft PR #14 contains **only** database migrations and documentation.
  There is no login page, auth callback, or SDK integration in that PR.
- Vercel preview build for the draft branch: READY, **but it has no auth UI**.
- Vercel project environment variables for Supabase: not configured.

## Not yet testable (blocking pilot)
- Real email sign-up, verification, login, logout and password reset.
- Two real authenticated users attempting cross-user reads and mutations.
- Supabase Auth Site URL and email provider configuration through the console
  (user screenshot showed configured URL; not independently API-checked).
- Mobile/PC synchronization, conflict handling, deletion tombstones.
- Complete SQLite + localStorage migration, backups, restore.
- PWA interaction smoke tests (Vercel Sandbox usage quota reached).

**Decision:** Backend schema policy inspection passed. Phase 1 **end-to-end
authentication has not passed** because it is not yet implemented.
Do not merge PR #14 or invite pilot users on the assumption that cloud
synchronization/backup is operational. Keep production unchanged.

## Next verification sequence
1. Add Supabase client/server auth implementation and pinned SDK lockfile.
2. Set project URL/publishable key on the **Preview branch** only.
3. Build Preview login page and callback; email confirmation URL whitelisting.
4. Create two disposable invited test accounts through supported Auth API and
   verify own-data access, cross-account isolation, sign-out, and expired-token
   cases; clean up only these disposable test records.
5. Review Security Advisor, integration tests and Vercel Preview before
   approving any production merge.
