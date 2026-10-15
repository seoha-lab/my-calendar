# Daymo — Phase 1: Supabase identity and cloud data foundation

Project: Supabase Seoul (ap-northeast-2). Never commit private API keys or database passwords.

## Applied migrations
- `20261014000100_initial_user_cloud_schema.sql`: ten cloud tables,
  user-scoped composite keys, RLS policies, restricted API grants, per-user
  default calendar, categories and shift types after auth signup.
- `20261014000200_restrict_internal_trigger_functions.sql`:
  removes PUBLIC / anon / authenticated execution of internal SECURITY DEFINER
  trigger functions.

## Important: NOT YET A LIVE SYNC SERVICE
This phase changes the Supabase database only. The production web app still
writes to its original local SQLite OPFS database and localStorage.

Do **not** erase browser storage, uninstall the PWA, or assume signing in will
migrate the existing schedule. The next phases require:

1. Implement an auth client using the official `@supabase/ssr` and
   `@supabase/supabase-js` SDKs. Keep package-lock consistent before merging.
2. Configure Preview-only project URL and publishable key environment variables.
3. Build login, callback, signout and password recovery UI. Keep the legacy
   app functional until migration is tested and explicitly enabled.
4. Use email authentication with confirmed email and invite-only pilot access.
5. Develop versioned JSON export/import from SQLite and local category storage.
   Validate counts, IDs, date ranges, shifts and categories before enabling sync.
6. Implement sync outbox, tombstones, optimistic revisions/conflict resolution.
7. Implement actual scheduled independent backups and restore tests.
8. Perform RLS tests with two distinct real JWTs; verify authenticated access
   to own rows and rejection of cross-user operations.

## Security notes
- All ten tables have RLS enabled.
- Owner policies apply to each user's normal data tables.
- `sync_operations` and `backup_snapshots` are client READ-only. Writes
  must be performed by audited server functions introduced in a later phase.
- No `service_role` key belongs in `NEXT_PUBLIC_*` or the browser bundle.
- Do not claim backups or synchronization are available yet.
- Supabase's default sending email provider is restricted/rate limited and
  needs a configured custom SMTP service before inviting real pilot users.
