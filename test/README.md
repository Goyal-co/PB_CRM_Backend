# PB-CRM API E2E tests

End-to-end integration tests hit a **running** NestJS API (`TEST_BASE_URL`) and a **real** Supabase project. There is no mocking of Supabase.

## Prerequisites

1. **Node dependencies** (from repo root):

   ```bash
   npm install
   ```

2. **Environment** — configure the **project root** `.env` (see `.env.example`):

   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (service role is required so the suite can create/update E2E users and profiles)
   - **`TEST_*` emails/passwords** — optional; if omitted, defaults in `test/helpers/e2e-bootstrap.ts` are used
   - `TEST_E2E_BOOTSTRAP=1` (default) — before `01-auth`, creates or updates the three Auth users and `profiles` rows via the service role. Set to `0` only if you manage those users manually

3. **Optional** — `test/.env.test` can override `TEST_BASE_URL` only; it does not override root `.env` Supabase keys.

4. **API server** — start the backend before running tests:

   ```bash
   npm run start:dev
   ```

## Configuration

- Jest config: `test/jest-e2e.json` (single worker, long timeout). Only files matching `test/[0-9][0-9]-*.e2e-spec.ts` are picked up so the suite stays ordered (`01-auth` … `21-cleanup`, with `20-admin-workflow` for super-admin directory / invitations / roster).
- Env loading: `test/jest-e2e-load-env.ts` runs first (so `process.env` is set before any import reads it), then `test/jest-e2e-setup.ts` registers `beforeAll` → `ensureAuthState()` (bootstrap users + JWTs + profile ids).
- Default `TEST_BASE_URL` is `http://127.0.0.1:3000` (not `localhost`) so on Windows the client does not resolve to IPv6 and hit a different process on port 3000.
- Shared mutable state: `test/shared-state.ts` (tokens and entity ids across ordered spec files).

## Commands

```bash
# Full suite (serial — same order as filenames 01 … 21)
npm run test:e2e

# Watch mode
npm run test:e2e:watch

# Dashboard + admin + project/form/agreement smoke (no bookings pipeline)
npm run test:e2e:core

# Single file
npx jest --config ./test/jest-e2e.json test/08-bookings-create.e2e-spec.ts --runInBand
```

## Notes

- Assertions use the app’s real HTTP status codes and `error.code` values (e.g. `UNAUTHORIZED`, `FORBIDDEN`, `DUPLICATE`).
- Some flows depend on database triggers/RPCs (payments, booking status, unit blocking). If a test fails, confirm migrations and Supabase functions match the API version.
- The last suite (`21-cleanup`) removes rows created with `TEST/` prefixes where possible; review before running against production-like data.
