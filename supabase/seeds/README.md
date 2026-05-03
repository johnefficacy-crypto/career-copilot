# Supabase seeds

Use this directory for non-production/demo seed SQL and local test fixtures.

## Rule
- `supabase/migrations/` is for schema and deterministic governance-safe data patches only.
- Do **not** add bulk demo users/content/credentials to migrations.

## Suggested usage
- Keep environment-specific seed files here (for example `dev_seed.sql`).
- Apply manually in local/dev environments after migrations.
