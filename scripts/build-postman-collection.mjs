/**
 * Generates Postman Collection v2.1 for Orchid Life CRM API.
 * Run: node scripts/build-postman-collection.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'postman', 'Orchid-Life-CRM-API.postman_collection.json');

/** Local Nest dev server (`npm run start:dev`) — all CRM routes use this origin in generated URLs. */
const LOCAL_HOST = 'localhost';
const LOCAL_PORT = '3000';
const LOCAL_CRM_BASE = `http://${LOCAL_HOST}:${LOCAL_PORT}/api/v1`;
const LOCAL_ORIGIN = `http://${LOCAL_HOST}:${LOCAL_PORT}`;

/**
 * Local Supabase stack (`supabase start`) — API + GoTrue Auth default port (not the Nest app).
 * Password login goes here, not to :3000. Hosted projects: change these URLs to `https://<ref>.supabase.co`.
 */
const LOCAL_SUPABASE_AUTH_HOST = 'localhost';
const LOCAL_SUPABASE_AUTH_PORT = '54321';
const LOCAL_SUPABASE_AUTH_ORIGIN = `http://${LOCAL_SUPABASE_AUTH_HOST}:${LOCAL_SUPABASE_AUTH_PORT}`;

const P = {
  projectId: '{{projectId}}',
  unitId: '{{unitId}}',
  formTemplateId: '{{formTemplateId}}',
  agreementTemplateId: '{{agreementTemplateId}}',
  bookingId: '{{bookingId}}',
  paymentId: '{{paymentId}}',
  documentId: '{{documentId}}',
  notificationId: '{{notificationId}}',
  userId: '{{userId}}',
  managerId: '{{managerId}}',
  fieldId: '{{fieldId}}',
  fieldId2: '{{fieldId2}}',
  sectionId: '{{sectionId}}',
  managerProjectId: '{{managerProjectId}}',
  profileId: '{{profileId}}',
};

const bearer = [
  {
    key: 'Authorization',
    value: 'Bearer {{accessToken}}',
    type: 'string',
  },
];

/**
 * Postman v2.1: `url` must include host/path (not only `raw`) or the URL bar stays empty in the desktop app.
 */
function parseQueryString(qs) {
  if (!qs) return [];
  return qs.split('&').map((pair) => {
    const i = pair.indexOf('=');
    if (i === -1) return { key: pair, value: '' };
    return { key: pair.slice(0, i), value: pair.slice(i + 1) };
  });
}

/** CRM API under /api/v1 — literal localhost URLs in the collection file. */
function buildCrmUrl(pathWithQuery) {
  const normalized = pathWithQuery.startsWith('/')
    ? pathWithQuery
    : `/${pathWithQuery}`;
  const qMark = normalized.indexOf('?');
  const pathname = qMark === -1 ? normalized : normalized.slice(0, qMark);
  const search = qMark === -1 ? '' : normalized.slice(qMark + 1);
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
  const path = ['api', 'v1', ...segments];
  const query = search ? parseQueryString(search) : undefined;
  const raw = `${LOCAL_CRM_BASE}${normalized}`;
  const u = {
    raw,
    protocol: 'http',
    host: [LOCAL_HOST],
    port: LOCAL_PORT,
    path,
  };
  if (query && query.length) u.query = query;
  return u;
}

/** Same origin, paths not under /api/v1 (e.g. Swagger UI at /api/docs). */
function buildLocalUrl(pathWithQuery) {
  const normalized = pathWithQuery.startsWith('/')
    ? pathWithQuery
    : `/${pathWithQuery}`;
  const qMark = normalized.indexOf('?');
  const pathname = qMark === -1 ? normalized : normalized.slice(0, qMark);
  const search = qMark === -1 ? '' : normalized.slice(qMark + 1);
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
  const query = search ? parseQueryString(search) : undefined;
  const raw = `${LOCAL_ORIGIN}${normalized}`;
  const u = {
    raw,
    protocol: 'http',
    host: [LOCAL_HOST],
    port: LOCAL_PORT,
    path: segments,
  };
  if (query && query.length) u.query = query;
  return u;
}

function localReq(name, method, pathWithQuery, opts = {}) {
  const normalized = pathWithQuery.startsWith('/')
    ? pathWithQuery
    : `/${pathWithQuery}`;
  const r = {
    name,
    request: {
      method,
      header: [...(opts.headers ?? [])],
      url: buildLocalUrl(normalized),
    },
  };
  if (opts.body) r.request.body = opts.body;
  if (opts.description) r.request.description = opts.description;
  return r;
}

/** Supabase GoTrue Auth API — local CLI default origin (localhost:54321), not Nest :3000. */
function buildSupabaseUrl(pathSegments, query) {
  const pathJoined = pathSegments.join('/');
  const qs =
    query && query.length
      ? `?${query.map((x) => `${x.key}=${x.value}`).join('&')}`
      : '';
  const raw = `${LOCAL_SUPABASE_AUTH_ORIGIN}/${pathJoined}${qs}`;
  const u = {
    raw,
    protocol: 'http',
    host: [LOCAL_SUPABASE_AUTH_HOST],
    port: LOCAL_SUPABASE_AUTH_PORT,
    path: pathSegments,
  };
  if (query && query.length) u.query = query;
  return u;
}

/** Supabase Auth (no CRM bearer). `pathSegments` e.g. ['auth','v1','token']; `query` e.g. [{key, value}]. */
function authReq(name, method, pathSegments, query, opts = {}) {
  const headers = [...(opts.headers ?? [])];
  const r = {
    name,
    request: {
      method,
      header: headers,
      url: buildSupabaseUrl(pathSegments, query ?? []),
    },
  };
  if (opts.body) {
    r.request.body = opts.body;
  }
  if (opts.description) {
    r.request.description = opts.description;
  }
  if (opts.event) {
    r.event = opts.event;
  }
  return r;
}

const saveTokensFromLoginTest = [
  {
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: [
        'try {',
        "  const j = pm.response.json();",
        "  if (j.access_token) pm.collectionVariables.set('accessToken', j.access_token);",
        "  if (j.refresh_token) pm.collectionVariables.set('refreshToken', j.refresh_token);",
        '} catch (e) { /* ignore */ }',
      ],
    },
  },
];

function req(name, method, urlPath, opts = {}) {
  const normalized = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const url = buildCrmUrl(normalized);

  const r = {
    name,
    request: {
      method,
      header: [...(opts.headers ?? []), ...bearer],
      url,
    },
  };

  if (opts.body) {
    r.request.body = opts.body;
  }
  if (opts.description) {
    r.request.description = opts.description;
  }
  if (opts.event) {
    r.event = opts.event;
  }
  return r;
}

const saveTokensFromCrmLoginTest = [
  {
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: [
        'try {',
        '  const j = pm.response.json();',
        "  if (j.data && j.data.access_token) {",
        "    pm.collectionVariables.set('accessToken', j.data.access_token);",
        '  }',
        "  if (j.data && j.data.refresh_token) {",
        "    pm.collectionVariables.set('refreshToken', j.data.refresh_token);",
        '  }',
        '} catch (e) { /* ignore */ }',
      ],
    },
  },
];

const rawJson = (obj) => ({
  mode: 'raw',
  raw: JSON.stringify(obj, null, 2),
  options: { raw: { language: 'json' } },
});

const collection = {
  info: {
    name: 'Orchid Life CRM API',
    description:
      'NestJS REST API for Titan PB CRM (PB-CRM).\n\n**Two local services:**\n- **CRM API:** `http://localhost:3000/api/v1` (`npm run start:dev`).\n- **Supabase Auth (sign-in):** `http://localhost:54321` — this is the Supabase CLI API port (GoTrue). Login is **not** implemented on :3000; the Nest app only validates JWTs.\n\nUse **`supabase start`** locally and paste **anon / service_role** keys from `supabase status`. For **hosted** Supabase only, edit Auth request URLs to `https://YOUR_PROJECT.supabase.co` (same paths `/auth/v1/...`).\n\n**Preferred:** **Auth (CRM API) → Login** (`/auth/login`). **First super_admin:** set `BOOTSTRAP_ADMIN_SECRET` in `.env`, then **Bootstrap first super_admin** (`POST /auth/bootstrap-admin`) once (409 if already done). Variable `bootstrapAdminSecret` in Postman must match.\n\n**Auth (local Supabase)** is optional.\n\n**Sign in (Supabase folder):** `supabaseAnonKey`, `authEmail`, `authPassword`.\n\n**IDs:** From API responses.\n\n**Upload:** form-data `file`, `booking_id`, `type` (`DocType` in code).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  variable: [
    {
      key: 'baseUrl',
      value: 'http://localhost:3000/api/v1',
    },
    { key: 'apiProtocol', value: 'http' },
    { key: 'apiHost', value: 'localhost' },
    { key: 'apiPort', value: '3000' },
    {
      key: 'supabaseAuthOrigin',
      value: 'http://localhost:54321',
    },
    { key: 'supabaseAnonKey', value: '' },
    {
      key: 'supabaseServiceRoleKey',
      value: '',
    },
    { key: 'authEmail', value: 'admin@gmail.com' },
    { key: 'authPassword', value: 'admin1234' },
    {
      key: 'bootstrapAdminSecret',
      value: '',
    },
    { key: 'refreshToken', value: '' },
    { key: 'lastCreatedAuthUserId', value: '' },
    { key: 'accessToken', value: '' },
    { key: 'projectId', value: '00000000-0000-4000-8000-000000000001' },
    { key: 'unitId', value: '00000000-0000-4000-8000-000000000002' },
    { key: 'formTemplateId', value: '00000000-0000-4000-8000-000000000003' },
    { key: 'agreementTemplateId', value: '00000000-0000-4000-8000-000000000004' },
    { key: 'bookingId', value: '00000000-0000-4000-8000-000000000005' },
    { key: 'paymentId', value: '00000000-0000-4000-8000-000000000006' },
    { key: 'documentId', value: '00000000-0000-4000-8000-000000000007' },
    { key: 'notificationId', value: '00000000-0000-4000-8000-000000000008' },
    { key: 'userId', value: '00000000-0000-4000-8000-000000000009' },
    { key: 'managerId', value: '00000000-0000-4000-8000-00000000000a' },
    { key: 'fieldId', value: '00000000-0000-4000-8000-00000000000b' },
    { key: 'fieldId2', value: '00000000-0000-4000-8000-0000000000c0' },
    { key: 'sectionId', value: '00000000-0000-4000-8000-00000000000c' },
    { key: 'managerProjectId', value: '00000000-0000-4000-8000-00000000000d' },
    { key: 'profileId', value: '00000000-0000-4000-8000-00000000000e' },
  ],
  item: [
    {
      name: 'Auth (local Supabase)',
      description:
        'Targets **`http://localhost:54321`** (Supabase CLI). Use anon/service keys from `supabase status`. Not the CRM server (:3000). For cloud-only, change each URL host to `https://YOUR_REF.supabase.co`.',
      item: [
        authReq(
          'Sign in (password)',
          'POST',
          ['auth', 'v1', 'token'],
          [{ key: 'grant_type', value: 'password' }],
          {
            description:
              'POST to **local GoTrue** (`:54321`), not Nest. Tests save `accessToken` / `refreshToken`. User must exist in Auth + `profiles` for CRM.',
            headers: [
              { key: 'apikey', value: '{{supabaseAnonKey}}', type: 'string' },
              { key: 'Content-Type', value: 'application/json', type: 'string' },
            ],
            body: rawJson({
              email: '{{authEmail}}',
              password: '{{authPassword}}',
            }),
            event: saveTokensFromLoginTest,
          },
        ),
        authReq(
          'Refresh session',
          'POST',
          ['auth', 'v1', 'token'],
          [{ key: 'grant_type', value: 'refresh_token' }],
          {
            description: 'Uses `refreshToken` variable. Tests update `accessToken` when present.',
            headers: [
              { key: 'apikey', value: '{{supabaseAnonKey}}', type: 'string' },
              { key: 'Content-Type', value: 'application/json', type: 'string' },
            ],
            body: rawJson({ refresh_token: '{{refreshToken}}' }),
            event: saveTokensFromLoginTest,
          },
        ),
        authReq(
          'Sign up (password, anon)',
          'POST',
          ['auth', 'v1', 'signup'],
          [],
          {
            description:
              'Only works if your Supabase project allows public sign-up. Prefer **Invite manager/user** or **Create auth user (service role)** for CRM onboarding.',
            headers: [
              { key: 'apikey', value: '{{supabaseAnonKey}}', type: 'string' },
              { key: 'Content-Type', value: 'application/json', type: 'string' },
            ],
            body: rawJson({
              email: '{{authEmail}}',
              password: '{{authPassword}}',
            }),
            event: saveTokensFromLoginTest,
          },
        ),
        authReq(
          'Create auth user (service role, bootstrap)',
          'POST',
          ['auth', 'v1', 'admin', 'users'],
          [],
          {
            description:
              '**Service role only.** Creates the Auth user (e.g. first super_admin). Then in Supabase SQL/Table Editor: insert or update `profiles` with `id` = returned user id and `role` = `super_admin` (or your workflow). Never expose service_role key in client apps.',
            headers: [
              {
                key: 'apikey',
                value: '{{supabaseServiceRoleKey}}',
                type: 'string',
              },
              {
                key: 'Authorization',
                value: 'Bearer {{supabaseServiceRoleKey}}',
                type: 'string',
              },
              { key: 'Content-Type', value: 'application/json', type: 'string' },
            ],
            body: rawJson({
              email: 'new.superadmin@example.com',
              password: 'Bootstrap_Strong_Pass_2026!',
              email_confirm: true,
              user_metadata: { first_name: 'Super', last_name: 'Admin' },
            }),
            event: [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'try {',
                    "  const j = pm.response.json();",
                    "  if (j.id) pm.collectionVariables.set('lastCreatedAuthUserId', j.id);",
                    '} catch (e) {}',
                  ],
                },
              },
            ],
          },
        ),
      ],
    },
    {
      name: 'Auth (CRM API)',
      description:
        'Login via Nest (`POST /auth/login`) — same Supabase credentials; tokens apply to all other CRM requests.',
      item: [
        req('Login (email + password)', 'POST', '/auth/login', {
          description:
            'Returns `{ success, data: { access_token, refresh_token, user, profile } }`. Tests store tokens in collection variables.',
          body: rawJson({
            email: '{{authEmail}}',
            password: '{{authPassword}}',
          }),
          event: saveTokensFromCrmLoginTest,
        }),
        req('Refresh session', 'POST', '/auth/refresh', {
          body: rawJson({ refresh_token: '{{refreshToken}}' }),
          event: saveTokensFromCrmLoginTest,
        }),
        req('Bootstrap first super_admin', 'POST', '/auth/bootstrap-admin', {
          description:
            'Requires `BOOTSTRAP_ADMIN_SECRET` in API `.env`. Fails with 409 if a super_admin already exists. Saves tokens like Login.',
          body: rawJson({
            bootstrap_secret: '{{bootstrapAdminSecret}}',
            email: '{{authEmail}}',
            password: '{{authPassword}}',
            first_name: 'Super',
            last_name: 'Admin',
          }),
          event: saveTokensFromCrmLoginTest,
        }),
      ],
    },
    {
      name: 'Meta (localhost)',
      description:
        'Utility routes on the same dev server (`http://localhost:3000`). Open Swagger in a browser to browse all operations.',
      item: [
        localReq('Swagger UI (open in browser)', 'GET', '/api/docs', {
          description:
            'HTML UI for OpenAPI. Default: `http://localhost:3000/api/docs` while `npm run start:dev` is running.',
        }),
      ],
    },
    {
      name: 'Projects',
      item: [
        req('List projects (paginated)', 'GET', '/projects?page=1&limit=20'),
        req('My projects (RPC)', 'GET', '/projects/my'),
        req('Project stats', 'GET', `/projects/${P.projectId}/stats`),
        req('Get project by id', 'GET', `/projects/${P.projectId}`),
        req('Create project', 'POST', '/projects', {
          body: rawJson({
            name: 'Orchid Life Towers',
            rera_number: 'PRM/KA/RERA/1251/446/PR/151223/006487',
            rera_website: 'https://rera.karnataka.gov.in',
            plan_sanction_no: 'BDA/2024/PLAN/8821',
            land_area_guntas: 120,
            total_units: 240,
            total_towers: 3,
            possession_date: '2027-12-31',
            address: 'Whitefield Main Road, Bangalore',
            city: 'Bengaluru',
            vendor_name: 'Sample Vendor Pvt Ltd',
            vendor_pan: 'AABCV1234C',
            vendor_address: 'MG Road, Bengaluru',
            vendor_phone: '+919876543210',
            vendor_email: 'vendor@example.com',
            vendor_rep_name: 'R. Kumar',
          }),
        }),
        req('Update project', 'PATCH', `/projects/${P.projectId}`, {
          body: rawJson({
            city: 'Bengaluru Urban',
            vendor_phone: '+919811122233',
          }),
        }),
        req('Soft-delete project', 'DELETE', `/projects/${P.projectId}`),
      ],
    },
    {
      name: 'Profiles',
      item: [
        req('Current user (me)', 'GET', '/profiles/me'),
        req('Update my profile', 'PATCH', '/profiles/me', {
          body: rawJson({
            first_name: 'Arjun',
            last_name: 'Mehta',
            phone: '+919988776655',
            communication_address: '12 MG Road, Bengaluru 560001',
            pan_no: 'ABCDE1234F',
          }),
        }),
        req('List managers', 'GET', '/profiles/managers'),
        req('List profiles (super_admin)', 'GET', '/profiles?page=1&limit=20&role=user&is_active=true&search=mehta'),
        req('Get profile by id', 'GET', `/profiles/${P.profileId}`),
        req('Update profile role', 'PATCH', `/profiles/${P.profileId}/role`, {
          body: rawJson({ role: 'manager' }),
        }),
        req('Assign manager to user', 'PATCH', `/profiles/${P.profileId}/assign-manager`, {
          body: rawJson({ manager_id: P.managerId }),
        }),
        req('Deactivate profile', 'PATCH', `/profiles/${P.profileId}/deactivate`),
      ],
    },
    {
      name: 'Admin',
      item: [
        req('Invite manager (CRM)', 'POST', '/admin/invitations', {
          description:
            'Requires `super_admin` JWT. Creates invitation + profile path per API; `role` is `manager`. Optional `project_ids`, `manager_id`.',
          body: rawJson({
            email: 'new.manager@example.com',
            role: 'manager',
            first_name: 'Priya',
            last_name: 'Shah',
            phone: '+919922334455',
            project_ids: [P.projectId],
            manager_id: P.managerId,
            notes: 'Assigned to project',
          }),
        }),
        req('Invite standard user (CRM)', 'POST', '/admin/invitations', {
          description:
            'Requires `super_admin` JWT. `role` is `user`. Link to a manager via `manager_id` when applicable.',
          body: rawJson({
            email: 'sales.user@example.com',
            role: 'user',
            first_name: 'Rahul',
            last_name: 'Verma',
            phone: '+919933445566',
            project_ids: [P.projectId],
            manager_id: P.managerId,
            notes: 'Field sales — sample',
          }),
        }),
        req('Assign user to project', 'POST', `/admin/users/${P.userId}/project-assignments`, {
          body: rawJson({ project_id: P.projectId }),
        }),
        req('Remove project assignment', 'DELETE', `/admin/users/${P.userId}/project-assignments/${P.projectId}`),
        req('Assign manager to user (admin)', 'PATCH', `/admin/users/${P.userId}/manager`, {
          body: rawJson({ manager_id: P.managerId }),
        }),
        req('Users directory', 'GET', '/admin/users-directory?page=1&limit=20&role=manager&is_active=true'),
        req('Project user summary', 'GET', `/admin/projects/${P.projectId}/user-summary`),
        req('Revoke user', 'POST', `/admin/users/${P.userId}/revoke`, {
          body: rawJson({ reason: 'Role change — access no longer needed' }),
        }),
        req('Reactivate user', 'POST', `/admin/users/${P.userId}/reactivate`),
      ],
    },
    {
      name: 'Manager projects',
      item: [
        req('List assignments', 'GET', `/manager-projects?manager_id=${P.managerId}&project_id=${P.projectId}`),
        req('Create assignment', 'POST', '/manager-projects', {
          body: rawJson({
            manager_id: P.managerId,
            project_id: P.projectId,
          }),
        }),
        req('Delete assignment', 'DELETE', `/manager-projects/${P.managerProjectId}`),
      ],
    },
    {
      name: 'Units',
      item: [
        req('Unit matrix', 'GET', `/units/matrix?project_id=${P.projectId}`),
        req('List units', 'GET', `/units?page=1&limit=20&project_id=${P.projectId}&tower=A&unit_type=3bhk&status=available`),
        req('Bulk create units', 'POST', '/units/bulk', {
          body: rawJson({
            units: [
              {
                project_id: P.projectId,
                unit_no: 'A-101',
                tower: 'A',
                floor_no: 1,
                unit_type: '3bhk',
                carpet_area_sqft: 1450,
                super_built_up_sqft: 1820,
                balcony_area_sqft: 120,
                no_of_parking: 2,
                facing: 'East',
                basic_rate_per_sqft: 7200,
                basic_sale_value: 13104000,
                gst_amount: 655200,
                maintenance_24mo: 120000,
                corpus_fund: 85000,
                other_charges: 45000,
                gross_apartment_value: 13999200,
                undivided_share_sqft: 450,
                undivided_share_fraction: '450/24000',
                remarks: 'Corner unit',
              },
            ],
          }),
        }),
        req('Get unit', 'GET', `/units/${P.unitId}`),
        req('Create unit', 'POST', '/units', {
          body: rawJson({
            project_id: P.projectId,
            unit_no: 'B-204',
            tower: 'B',
            floor_no: 2,
            unit_type: '2bhk',
            carpet_area_sqft: 1180,
            super_built_up_sqft: 1490,
            basic_rate_per_sqft: 6950,
            basic_sale_value: 8201000,
            gst_amount: 410050,
            facing: 'North',
          }),
        }),
        req('Update unit', 'PATCH', `/units/${P.unitId}`, {
          body: rawJson({
            remarks: 'Hold for VIP',
          }),
        }),
      ],
    },
    {
      name: 'Form templates',
      item: [
        req('List templates', 'GET', `/form-templates?page=1&limit=20&project_id=${P.projectId}&is_active=true`),
        req('Create template', 'POST', '/form-templates', {
          body: rawJson({
            project_id: P.projectId,
            name: 'Booking form v1',
            description: 'Standard allotment questionnaire',
          }),
        }),
        req('List sections', 'GET', `/form-templates/${P.formTemplateId}/sections`),
        req('Create section', 'POST', `/form-templates/${P.formTemplateId}/sections`, {
          body: rawJson({
            section_label: 'Applicant details',
            section_key: 'applicant_details',
            display_order: 0,
            is_active: true,
          }),
        }),
        req('Patch section', 'PATCH', `/form-templates/${P.formTemplateId}/sections/${P.sectionId}`, {
          body: rawJson({ section_label: 'Primary applicant', display_order: 1 }),
        }),
        req('Delete section', 'DELETE', `/form-templates/${P.formTemplateId}/sections/${P.sectionId}`),
        req('List fields', 'GET', `/form-templates/${P.formTemplateId}/fields?page=1&limit=50&section_id=${P.sectionId}&is_active=true`),
        req('Create field', 'POST', `/form-templates/${P.formTemplateId}/fields`, {
          body: rawJson({
            section_id: P.sectionId,
            field_key: 'applicant_full_name',
            field_label: 'Full name',
            data_type: 'text',
            is_required: true,
            visible_to_user: true,
            editable_by_user: true,
            display_order: 0,
            placeholder: 'As per PAN',
          }),
        }),
        req('Reorder fields', 'PATCH', `/form-templates/${P.formTemplateId}/fields/reorder`, {
          body: rawJson({
            fields: [
              { id: P.fieldId, display_order: 0 },
              { id: P.fieldId2, display_order: 1 },
            ],
          }),
        }),
        req('Toggle field flags', 'PATCH', `/form-templates/${P.formTemplateId}/fields/${P.fieldId}/toggle`, {
          body: rawJson({ visible_to_user: true, editable_by_user: false, is_active: true }),
        }),
        req('Update field', 'PATCH', `/form-templates/${P.formTemplateId}/fields/${P.fieldId}`, {
          body: rawJson({
            field_label: 'Applicant full name (as per ID)',
            help_text: 'Must match KYC',
          }),
        }),
        req('Delete field', 'DELETE', `/form-templates/${P.formTemplateId}/fields/${P.fieldId}`),
        req('Get template detail', 'GET', `/form-templates/${P.formTemplateId}`),
        req('Patch template', 'PATCH', `/form-templates/${P.formTemplateId}`, {
          body: rawJson({ name: 'Booking form v1.1', is_active: true }),
        }),
        req('Delete template', 'DELETE', `/form-templates/${P.formTemplateId}`),
      ],
    },
    {
      name: 'Agreement templates',
      item: [
        req('List agreement templates', 'GET', `/agreement-templates?page=1&limit=20&project_id=${P.projectId}&is_active=true`),
        req('Get agreement template', 'GET', `/agreement-templates/${P.agreementTemplateId}`),
        req('Create agreement template', 'POST', '/agreement-templates', {
          body: rawJson({
            project_id: P.projectId,
            name: 'AFS — Standard 2026',
            description: 'Agreement for sale',
            body_html:
              '<html><body><h1>Agreement for sale</h1><p>Buyer: PLACEHOLDER_BUYER_NAME</p></body></html>',
            header_html: '<div class="header">ORCHID LIFE</div>',
            footer_html: '<div class="footer">Confidential</div>',
            page_size: 'A4',
            margin_top: 20,
            margin_bottom: 20,
            margin_left: 18,
            margin_right: 18,
            is_active: true,
          }),
        }),
        req('Update agreement template', 'PATCH', `/agreement-templates/${P.agreementTemplateId}`, {
          body: rawJson({ description: 'Updated footer and margins', margin_bottom: 24 }),
        }),
        req('Delete agreement template', 'DELETE', `/agreement-templates/${P.agreementTemplateId}`),
      ],
    },
    {
      name: 'Bookings',
      item: [
        req('Pending review', 'GET', '/bookings/pending-review'),
        req('Workspace bookings', 'GET', `/bookings/workspace?page=1&limit=20&status=draft&project_id=${P.projectId}&search=kumar`),
        req('List bookings', 'GET', `/bookings?page=1&limit=20&project_id=${P.projectId}&status=draft&tower=A&unit_type=3bhk&search=ORC`),
        req('Create draft booking', 'POST', '/bookings', {
          body: rawJson({
            project_id: P.projectId,
            unit_id: P.unitId,
            form_template_id: P.formTemplateId,
            agreement_template_id: P.agreementTemplateId,
            joint_allottees: [
              { first_name: 'Sita', last_name: 'Rao', phone: '+919900112233', email: 'sita@example.com' },
            ],
            allottee_address: '221B Baker Streetlayout, Bengaluru',
            allottee_phone: '+919876512340',
            allottee_email: 'buyer@example.com',
            agent_name: 'RERA Agent Co',
            agent_rera_no: 'AG Karnataka 554433',
            agent_contact_no: '+919811100022',
            fund_source: 'Savings + HDFC home loan',
            home_loan_pct: 75,
            notes: 'Priority booking — sample',
          }),
        }),
        req('Get booking form payload', 'GET', `/bookings/${P.bookingId}/form`),
        req('Merged agreement HTML', 'GET', `/bookings/${P.bookingId}/merged-agreement`),
        req('Submit booking', 'POST', `/bookings/${P.bookingId}/submit`),
        req('Start review', 'POST', `/bookings/${P.bookingId}/start-review`),
        req('Review field', 'PATCH', `/bookings/${P.bookingId}/review-field`, {
          body: rawJson({
            field_id: P.fieldId,
            status: 'ok',
            note: 'Verified against PAN',
          }),
        }),
        req('Complete review', 'PATCH', `/bookings/${P.bookingId}/complete-review`, {
          body: rawJson({ action: 'approve', notes: 'All KYC acceptable' }),
        }),
        req('Record agreement generated', 'POST', `/bookings/${P.bookingId}/record-agreement`, {
          body: rawJson({
            storage_path: 'agreements/sample-booking/agreement.pdf',
            file_name: 'agreement.pdf',
            size_bytes: 524288,
            preview_url: 'https://example.com/preview',
          }),
        }),
        req('Mark agreement printed', 'PATCH', `/bookings/${P.bookingId}/mark-printed`),
        req('Cancel booking', 'PATCH', `/bookings/${P.bookingId}/cancel`, {
          body: rawJson({ reason: 'Customer withdrew', is_allottee_cancel: true }),
        }),
        req('Possession update', 'PATCH', `/bookings/${P.bookingId}/possession`, {
          body: rawJson({
            oc_date: '2026-06-01',
            possession_offered_at: '2026-06-15T10:00:00.000Z',
            possession_taken_at: '2026-06-20T14:30:00.000Z',
          }),
        }),
        req('Registration complete', 'PATCH', `/bookings/${P.bookingId}/registration`, {
          body: rawJson({
            sale_deed_registered_at: '2026-07-01',
            stamp_duty_amount: 450000,
            registration_charges: 28000,
          }),
        }),
        req('Get booking detail', 'GET', `/bookings/${P.bookingId}`),
        req('Update booking (draft fields)', 'PATCH', `/bookings/${P.bookingId}`, {
          body: rawJson({
            allottee_phone: '+919977665544',
            notes: 'Revised contact',
          }),
        }),
      ],
    },
    {
      name: 'Field values',
      item: [
        req('Get field values for booking', 'GET', `/field-values/${P.bookingId}`),
        req('Bulk upsert field values', 'PUT', `/field-values/${P.bookingId}/bulk`, {
          body: rawJson({
            values: [
              { field_id: P.fieldId, value_text: 'Rahul Verma' },
              {
                field_id: P.fieldId2,
                value_number: 42,
                value_date: '1990-05-15',
                value_boolean: true,
                value_json: { city: 'Mumbai' },
              },
            ],
          }),
        }),
        req('Upsert single field value', 'PUT', `/field-values/${P.bookingId}/${P.fieldId}`, {
          body: rawJson({ value_text: 'Updated value' }),
        }),
      ],
    },
    {
      name: 'Documents',
      item: [
        req('List documents', 'GET', `/documents?page=1&limit=20&booking_id=${P.bookingId}&type=aadhar_card&is_verified=false`),
        req('Upload document (multipart)', 'POST', '/documents/upload', {
          description:
            'Body → form-data: attach `file`, set text fields `booking_id`, `type` (e.g. aadhar_card, pan_card, payment_receipt). Optional: allottee_index, notes.',
          body: {
            mode: 'formdata',
            formdata: [
              { key: 'booking_id', type: 'text', value: P.bookingId },
              { key: 'type', type: 'text', value: 'aadhar_card' },
              { key: 'allottee_index', type: 'text', value: '0' },
              { key: 'notes', type: 'text', value: 'Sample KYC upload' },
              { key: 'file', type: 'file', src: [] },
            ],
          },
        }),
        req('Signed URL only', 'GET', `/documents/${P.documentId}/signed-url`),
        req('Document metadata + URL', 'GET', `/documents/${P.documentId}`),
        req('Delete document', 'DELETE', `/documents/${P.documentId}`),
        req('Verify document', 'PATCH', `/documents/${P.documentId}/verify`, {
          body: rawJson({ is_verified: true }),
        }),
        req('Reject document', 'PATCH', `/documents/${P.documentId}/verify`, {
          body: rawJson({
            is_verified: false,
            rejection_reason: 'Photo unclear — reupload',
          }),
        }),
      ],
    },
    {
      name: 'Payments',
      item: [
        req('Collections summary', 'GET', `/payments/collections?year=2026&month=3&project_id=${P.projectId}`),
        req('Payment summary for booking', 'GET', `/payments/booking/${P.bookingId}`),
        req('List payments', 'GET', `/payments?page=1&limit=20&booking_id=${P.bookingId}&status=pending&milestone=booking_5pct`),
        req('Payment detail', 'GET', `/payments/${P.paymentId}`),
        req('Record payment', 'PATCH', `/payments/${P.paymentId}/record`, {
          body: rawJson({
            amount_paid: 250000,
            payment_method: 'neft',
            bank_name: 'HDFC Bank',
            paid_at: '2026-03-28T12:00:00.000Z',
            tds_deducted: 0,
            notes: 'Booking milestone',
          }),
        }),
        req('Mark cleared', 'PATCH', `/payments/${P.paymentId}/clear`),
        req('Mark bounced', 'PATCH', `/payments/${P.paymentId}/bounce`),
        req('Demand payment', 'PATCH', `/payments/${P.paymentId}/demand`, {
          body: rawJson({
            due_date: '2026-04-15',
            notice_number: 1,
          }),
        }),
        req('Apply interest', 'PATCH', `/payments/${P.paymentId}/interest`, {
          body: rawJson({
            interest_rate: 12,
            interest_amount: 1500.5,
            interest_from_date: '2026-02-01',
          }),
        }),
      ],
    },
    {
      name: 'Notifications',
      item: [
        req('List my notifications', 'GET', '/notifications?page=1&limit=20&is_read=false'),
        req('Mark all read', 'PATCH', '/notifications/mark-all-read'),
        req('Mark one read', 'PATCH', `/notifications/${P.notificationId}/read`),
        req('Create notification', 'POST', '/notifications', {
          body: rawJson({
            user_id: P.userId,
            booking_id: P.bookingId,
            type: 'payment_demand',
            title: 'Payment due',
            body: 'Milestone booking_5pct is overdue.',
            action_url: `/bookings/${P.bookingId}`,
            metadata: { milestone: 'booking_5pct', amount: 250000 },
          }),
        }),
      ],
    },
    {
      name: 'Dashboard',
      item: [
        req('KPIs', 'GET', '/dashboard/kpis'),
        req('Booking funnel', 'GET', `/dashboard/booking-funnel?project_id=${P.projectId}`),
        req('Inventory summary', 'GET', `/dashboard/inventory-summary?project_id=${P.projectId}`),
        req('Recent activity', 'GET', `/dashboard/recent-activity?project_id=${P.projectId}&limit=15`),
      ],
    },
    {
      name: 'Audit',
      item: [
        req('Audit log', 'GET', `/audit?page=1&limit=20&booking_id=${P.bookingId}&user_id=${P.userId}&action=update&entity=booking`),
        req('Audit for booking', 'GET', `/audit/booking/${P.bookingId}`),
      ],
    },
  ],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2), 'utf8');
console.log('Wrote', outPath);
