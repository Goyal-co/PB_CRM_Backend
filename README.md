# Orchid Life CRM API

Production-oriented **NestJS 10** REST API for **Titan PB CRM** (Goyal Hariyana Associates, Bangalore). Stack: **Fastify**, **Supabase JS v2** (PostgreSQL + Auth + Storage), **Swagger**, **class-validator**.

## Prerequisites

- Node.js 20+
- Supabase project with your schema, RLS policies, views (`v_booking_list`, `v_unit_matrix`, `v_my_booking`), and RPCs (`submit_booking`, `start_review`, `review_field`, `complete_review`, `record_agreement_generated`, `mark_agreement_printed`, `get_booking_form`, `get_dashboard_kpis`, `get_payment_summary`, `get_merged_agreement`, …)

## Setup

```bash
cp .env.example .env
# Fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGINS, etc.
npm install
npm run start:dev
```

- API base path: `http://localhost:3000/api/v1`
- OpenAPI UI: `http://localhost:3000/api/docs`

## Auth

Every request (except future `@Public()` routes) must send:

`Authorization: Bearer <Supabase access JWT>`

The **SupabaseAuthGuard** calls `supabase.auth.getUser(token)` with the service-role client, then loads `profiles` and attaches `request.user` (`CurrentUser`: `id`, `email`, `role`, `profile`).

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run build`| Compile to `dist/`         |
| `npm run start:prod` | Run compiled app   |
| `npm run start:dev`  | Watch mode         |
| `npm test`     | Unit tests (Jest)          |
| `npm run test:e2e` | E2E (smoke)        |

## Module map (high level)

| Prefix | Module |
|--------|--------|
| `/projects` | Projects CRUD + stats |
| `/profiles` | Profiles, roles, managers |
| `/manager-projects` | Manager ↔ project links |
| `/units` | Inventory, matrix, bulk import |
| `/form-templates` | Dynamic form builder |
| `/agreement-templates` | Agreement HTML templates |
| `/bookings` | Draft → registration lifecycle + RPCs |
| `/field-values` | `booking_field_values` + `field_snapshot` |
| `/documents` | Multipart uploads + Storage signed URLs |
| `/payments` | Milestones, demand, clearance, collections |
| `/notifications` | In-app notifications |
| `/dashboard` | KPIs, funnel, inventory, activity |
| `/audit` | Audit log reads |

Detailed routes match the product specification embedded in the repository prompts; Swagger lists every operation with DTO shapes.

## Environment

See `.env.example`. **Rate limiting:** `THROTTLE_TTL` is interpreted as **seconds** in config and converted to **milliseconds** for `@nestjs/throttler`.

## Tests

- **Unit:** `src/**/*.spec.ts` — services use mocked `SupabaseService`.
- **E2E:** `test/app.e2e-spec.ts` — verifies anonymous requests receive `401` on a protected route.

## Notes

- **Column names** on views (`v_booking_list` search fields, etc.) may need alignment with your exact view definition.
- **`add_form_field` RPC:** if absent, form field creation falls back to inserting into `form_fields`.
- **DTO strict initialization** is relaxed via `strictPropertyInitialization: false` while keeping other `strict` flags enabled, which is standard for Nest DTO classes.

## License

Proprietary — Goyal Hariyana Associates / Orchid Life (RERA: PRM/KA/RERA/1251/446/PR/151223/006487).
