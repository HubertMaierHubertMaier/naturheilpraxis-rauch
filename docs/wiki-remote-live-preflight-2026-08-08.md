# Wiki Remote and Live Preflight - 2026-08-08

## Scope

This preflight is read-only. It does not link a local CLI project, authenticate
to the remote database, apply migrations, import source cards, or publish any
therapy material.

The reviewed integration head is `3fcdb06d381d04062b8a2512a3d2c66cf069c460`
on `database-integration-20260808`, 38 commits ahead of `origin/main`.

## Local Verification

- `git diff --check origin/main..HEAD` completed without whitespace errors.
- `node scripts/build-klinghardt-import-batch.mjs --verify` completed without
  output or a non-zero exit status.
- `npx vitest run src/test/therapy-retrieval-postgres-conformance.test.ts`
  passed 6/6 tests. The harness requires PostgreSQL 17 for the six bounded
  runtime groups and contains no deployment path.
- The Phase 1 through Phase 3 chain passed 84/84 tests across seven test
  files, including PGlite migrations, import staging, candidate contracts,
  draft promotion, and release contracts.
- `node --test test/klinghardt-import-batch.test.mjs` passed 2/2 tests.
- TypeScript validation for `tsconfig.app.json` and `tsconfig.node.json`
  completed without errors.
- The generated Klinghardt batch remains unpublished and source-neutral.
  It does not grant evidence, safety, dosage, or patient-use approval.

## Remote Reachability and Access

- A read-only `HEAD` request to
  `https://jmebqjadlpltnqawoipb.supabase.co/rest/v1/` returned HTTP 401. This
  confirms that the endpoint is reachable and correctly requires credentials.
- Supabase CLI 2.113.0 is available locally, but no linked project or database
  password is configured. `supabase migration list` requires either a linked
  project or an explicit database URL and password.
- No Supabase database password, access token, or generic Supabase token is
  present in the current environment.

## Remaining Gates

1. Run the six PostgreSQL 17 runtime groups in a disposable isolated database.
   No local PostgreSQL service, Docker, or Podman runtime is installed here.
2. Provide authorized read-only remote database access if the remote migration
   status must be compared. Access must not be supplied in source control.
3. Obtain explicit approval before any link, migration, source-card import,
   release promotion, clinical approval, or live deployment.

## Result

The integration is locally prepared and remains inactive. This preflight does
not establish permission or readiness for a live rollout.
