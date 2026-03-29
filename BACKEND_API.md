# Orchid Life CRM - Backend API (Full Documentation)

Base URL (global prefix): `http://<host>:3000/api/v1`

This API is implemented with NestJS + Fastify. All responses are wrapped by a global success/error envelope (see **Response Format** below).

## Auth, Roles, and Common Behavior

### Authentication
- Use `Authorization: Bearer <access_token>` for all protected routes.
- Obtain tokens via:
  - `POST /auth/login` (public)
  - `POST /auth/refresh` (public)

### Roles
Roles used across the project:
- `super_admin`
- `manager`
- `user`

`RolesGuard` behavior:
- If `super_admin` is the caller, role checks pass regardless of the required roles.
- Otherwise, the caller must match one of the required roles on the route.

### Response Format (Success)
Most endpoints return a JSON object:
```json
{
  "success": true,
  "data": { "...endpoint result..." },
  "meta": { "...pagination/extra..." } 
}
```

Notes:
- If a controller returns `{ data: ... }` and optionally `meta`, the interceptor formats it into `{ success: true, data, meta }`.
- If a controller returns something else, the interceptor will still wrap it as `{ success: true, data: <body> }`.

### Response Format (Errors)
All errors are returned in a JSON envelope:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient role",
    "details": { "...optional..." }
  },
  "statusCode": 403
}
```

Where `code` is derived from HTTP status or thrown exception `error` field.

### Pagination Defaults (common)
DTO `PaginationDto` defines:
- `page` (default `1`, minimum `1`)
- `limit` (default `20`, minimum `1`, maximum `100`)

## API Modules and Endpoints

## 1) Auth

### `POST /auth/login` (Public)
Sign in using Supabase Auth (anon key).
Body (`LoginDto`):
- `email: string` (email)
- `password: string` (non-empty)

Response (`200`):
- `{ success: true, data: <login/session result> }`

### `POST /auth/refresh` (Public)
Refresh access token.
Body (`RefreshTokenDto`):
- `refresh_token: string`

Response (`200`):
- `{ success: true, data: <new session result> }`

### `POST /auth/bootstrap-admin` (Public, secret gated)
Creates the initial `super_admin` when bootstrap is enabled.
Body (`BootstrapAdminDto`):
- `bootstrap_secret: string`
- `email: string`
- `password: string` (min 8)
- `first_name: string`
- `last_name: string`

Response (`201`):
- `{ success: true, data: <session result> }`

## 2) Admin (`super_admin` only)
All endpoints below require:
- `Authorization: Bearer <token>` and
- `super_admin` role (controller-level `@UseGuards(RolesGuard)` + `@Roles('super_admin')`)

### `POST /admin/invitations`
Create an admin invitation.
Body (`CreateInvitationDto`):
- `email: string` (email)
- `role: 'manager' | 'user'`
- `first_name: string`
- `last_name: string`
- `phone?: string`
- `project_ids?: string[]` (UUIDs)
- `manager_id?: string` (UUID)
- `notes?: string`

Response (`201`): `{ success: true, data: ... }`

### `POST /admin/users/:userId/project-assignments` (`200`)
Assign a manager/user to a project.
Body (`AssignProjectBodyDto`):
- `project_id: string` (UUID)

Response (`200`): `{ success: true, data: ... }`

### `DELETE /admin/users/:userId/project-assignments/:projectId` (`200`)
Remove project assignment.

Response (`200`): `{ success: true, data: ... }`

### `PATCH /admin/users/:userId/manager` (`200`)
Assign a manager to a user.
Body (`AssignManagerDto`):
- `manager_id: string` (UUID)

Response (`200`): `{ success: true, data: ... }`

### `GET /admin/users-directory`
Admin directory listing.
Query (`QueryAdminUsersDto`):
- pagination: `page`, `limit`
- `role?: 'super_admin' | 'manager' | 'user'`
- `project_id?: string` (UUID)
- `is_active?: boolean`
- `search?: string`

Response (`200`): `{ success: true, data: ... }`

### `GET /admin/projects/:projectId/user-summary`
Project roster summary.

Response (`200`): `{ success: true, data: ... }`

### `POST /admin/users/:userId/revoke` (`200`)
Deactivate profile and project access.
Body (`RevokeUserBodyDto`):
- `reason?: string`

Response (`200`): `{ success: true, data: ... }`

### `POST /admin/users/:userId/reactivate` (`200`)
Reactivate profile.

Response (`200`): `{ success: true, data: ... }`

## 3) Projects

### `GET /projects`
List active projects.
Query (`PaginationDto`):
- `page?: number`
- `limit?: number`

Response (`200`): `{ success: true, data: [...], meta: {...} }`

### `GET /projects/my`
Projects assigned to the current user.

Response (`200`): `{ success: true, data: [...] }`

### `GET /projects/:id`
Get one project.

Response (`200`): `{ success: true, data: {...} }`

### `GET /projects/:id/stats` (`super_admin` or `manager`)
Project KPI stats.

Response (`200`): `{ success: true, data: {...} }`

### `POST /projects` (`super_admin`)
Body (`CreateProjectDto`):
- `name: string`
- `rera_number: string`
- `rera_website: string`
- `plan_sanction_no: string`
- `land_area_guntas: number` (min 0)
- `total_units?: number` (optional int)
- `total_towers?: number` (optional int, min 1)
- `possession_date: string` (date string)
- `address: string`
- `city?: string`
- `vendor_name?: string`
- `vendor_pan?: string`
- `vendor_address?: string`
- `vendor_phone?: string`
- `vendor_email?: string`
- `vendor_rep_name?: string`

Response (`201`): `{ success: true, data: {...} }`

### `PATCH /projects/:id` (`super_admin`)
Body (`UpdateProjectDto`):
- Partial of `CreateProjectDto`

Response (`200`): `{ success: true, data: {...} }`

### `DELETE /projects/:id` (`super_admin`)
Soft-delete project.

Response (`200`): `{ success: true, data: { success: true } }`

## 4) Profiles

### `GET /profiles/me`
Current authenticated user profile.

Response (`200`): `{ success: true, data: {...} }`

### `PATCH /profiles/me`
Update current user profile.
Body (`UpdateProfileDto`):
- Any subset of:
  - `first_name?: string`
  - `last_name?: string`
  - `father_husband_name?: string`
  - `date_of_birth?: string` (date)
  - `marital_status?: string`
  - `nationality?: string`
  - `aadhar_no?: string`
  - `pan_no?: string`
  - `phone?: string`
  - `alternate_phone?: string`
  - `communication_address?: string`
  - `permanent_address?: string`
  - `occupation?: string`
  - `employer_name?: string`
  - `designation?: string`
  - `place_of_business?: string`
- `role` can be present in the DTO but is ignored by API policy (DB/RLS prevents self-promotion).

Response (`200`): `{ success: true, data: {...} }`

### `GET /profiles/managers` (`super_admin`)
List managers with project ids.

Response (`200`): `{ success: true, data: [...], meta: { total: ... } }`

### `GET /profiles` (`super_admin`)
List profiles.
Query (`QueryProfilesDto`):
- `page`, `limit`
- `role?: 'super_admin' | 'manager' | 'user'`
- `is_active?: boolean`
- `search?: string`

Response (`200`): `{ success: true, data: [...], meta: {...} }`

### `GET /profiles/:id`
Get profile by id (authorization depends on role/ownership via service).

Response (`200`): `{ success: true, data: {...} }`

### `PATCH /profiles/:id/role` (`super_admin`)
Update user role.
Body (`UpdateRoleDto`):
- `role: 'super_admin' | 'manager' | 'user'`

Response (`200`): `{ success: true, data: ... }`

### `PATCH /profiles/:id/assign-manager` (`super_admin`)
Assign manager to a user.
Body (`AssignManagerDto`):
- `manager_id: string` (UUID)

Response (`200`): `{ success: true, data: ... }`

### `PATCH /profiles/:id/deactivate` (`super_admin`)
Deactivate user.

Response (`200`): `{ success: true, data: { success: true } }`

## 5) Units

### `GET /units`
List units.
Query (`QueryUnitsDto`):
- `page`, `limit`
- `project_id?: UUID`
- `tower?: 'A' | 'B' | 'C' | 'D' | 'E'`
- `unit_type?: '2bhk' | '2_5bhk' | '3bhk'`
- `status?: 'available' | 'blocked' | 'booked' | 'agreement_signed' | 'registered' | 'cancelled'`

Response (`200`): `{ success: true, data: [...], meta: {...} }`

### `GET /units/matrix` (`super_admin` or `manager`)
Unit matrix by tower.
Query:
- `project_id: UUID` (required)

Response (`200`): `{ success: true, data: {...} }`

### `GET /units/:id`
Get unit by id.

Response (`200`): `{ success: true, data: {...} }`

### `POST /units/bulk` (`super_admin`)
Bulk create units.
Body (`BulkUnitsDto`):
- `units: CreateUnitDto[]` (array min 1, max 100)

### `POST /units` (`super_admin`)
Create unit.
Body (`CreateUnitDto`):
- `project_id: UUID`
- `unit_no: string`
- `tower: 'A' | 'B' | 'C' | 'D' | 'E'`
- `floor_no: number` (int)
- `unit_type: '2bhk' | '2_5bhk' | '3bhk'`
- `carpet_area_sqft: number`
- `super_built_up_sqft: number`
- optional:
  - `balcony_area_sqft?: number`
  - `no_of_parking?: number`
  - `facing?: string`
  - `gst_amount?: number`
  - `maintenance_24mo?: number`
  - `corpus_fund?: number`
  - `other_charges?: number`
  - `gross_apartment_value?: number`
  - `undivided_share_sqft?: number`
  - `undivided_share_fraction?: string`
  - `floor_plan_url?: string`
  - `remarks?: string`
- required pricing:
  - `basic_rate_per_sqft: number`
  - `basic_sale_value: number`

Response (`201`): `{ success: true, data: {...} }`

### `PATCH /units/:id` (`super_admin`)
Update unit.
Body (`UpdateUnitDto`): partial of `CreateUnitDto`

Response (`200`): `{ success: true, data: {...} }`

## 6) Manager Projects

### `GET /manager-projects` (`super_admin` or `manager`)
List assignments.
Query:
- `manager_id?: string` (UUID)
- `project_id?: string` (UUID)

Response (`200`): `{ success: true, data: [...], meta: { total: ... } }`

### `POST /manager-projects` (`super_admin`)
Create assignment.
Body (`CreateManagerProjectDto`):
- `manager_id: UUID`
- `project_id: UUID`

Response (`201`): `{ success: true, data: {...} }`

### `DELETE /manager-projects/:id` (`super_admin`)
Delete assignment.

Response (`200`): `{ success: true, data: ... }`

## 7) Audit

### `GET /audit`
Paginated audit log.
Query (`QueryAuditDto`):
- `page`, `limit`
- `booking_id?: UUID`
- `user_id?: UUID`
- `action?: string`
- `entity?: string`

Response (`200`): `{ success: true, data: [...], meta: {...} }`

### `GET /audit/booking/:bookingId`
Chronological audit for booking.

Response (`200`): `{ success: true, data: [...], meta: {...} }`

## 8) Dashboard

### `GET /dashboard/my-summary` (`user` only)
Own bookings summary by status.

Response (`200`): `{ success: true, data: { by_status, total, ... } }`

### `GET /dashboard/kpis` (`super_admin` or `manager`)
KPI object (RPC-backed).

Response (`200`): `{ success: true, data: {...} }`

### `GET /dashboard/booking-funnel` (`super_admin` or `manager`)
Booking funnel counts.
Query:
- `project_id?: UUID`

Response (`200`): `{ success: true, data: {...} }`

### `GET /dashboard/inventory-summary` (`super_admin` or `manager`)
Inventory grouped summary.
Query:
- `project_id?: UUID`

Response (`200`): `{ success: true, data: {...} }`

### `GET /dashboard/recent-activity` (`super_admin` or `manager`)
Latest audit activities.
Query (`DashboardQuery`):
- `project_id?: UUID`
- `limit?: int` (1..50)

Response (`200`): `{ success: true, data: {...} }`

## 9) Bookings

### `GET /bookings/pending-review` (`super_admin` or `manager`)
Bookings pending review.

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `GET /bookings/workspace`
Bookings in my assigned projects (service scopes by caller token).
Query (`QueryWorkspaceBookingsDto`):
- `page`, `limit`
- `status?: string`
- `project_id?: UUID`
- `search?: string`

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `GET /bookings`
Role-filtered booking list.
Query (`QueryBookingsDto`):
- `page`, `limit`
- `project_id?: UUID`
- `status?: BookingStatus` (e.g. `draft`, `submitted`, `under_review`, ...)
- `assigned_manager_id?: UUID`
- `tower?: 'A'|'B'|'C'|'D'|'E'`
- `unit_type?: '2bhk'|'2_5bhk'|'3bhk'`
- `search?: string`

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `POST /bookings`
Create draft booking.
Body (`CreateBookingDto`):
- `project_id: UUID`
- `unit_id: UUID`
- `form_template_id: UUID`
- `agreement_template_id: UUID`
- `joint_allottees?: JointAllotteeDto[]` (max 2)
- `allottee_address?: string`
- `allottee_phone?: string`
- `allottee_email?: string`
- agent fields (optional):
  - `agent_name?: string`
  - `agent_rera_no?: string`
  - `agent_represented_by?: string`
  - `agent_contact_no?: string`
  - `agent_email?: string`
- `fund_source?: string`
- `home_loan_pct?: number` (min 0, max 100)
- `notes?: string`

Joint allottee (`JointAllotteeDto`):
- `first_name?: string`
- `last_name?: string`
- `phone?: string`
- `email?: string`

Response (`201`): `{ success: true, data: bookingRow }`

### `GET /bookings/:id/form`
Get booking form structure / payload (RPC).

Response (`200`): `{ success: true, data: <form payload> }`

### `GET /bookings/:id/merged-agreement` (`super_admin` or `manager`)
Merged agreement HTML.

Response (`200`): `{ success: true, data: { merged_html, header_html?, footer_html?, ... } }`

### `POST /bookings/:id/submit` (`200`)
Submit booking (allottee/user flow via RPC).

Response (`200`): `{ success: true, data: <rpc result> }`

### `POST /bookings/:id/start-review` (`super_admin` or `manager`, `200`)
Start manager review.

Response (`200`): `{ success: true, data: <rpc result> }`

### `PATCH /bookings/:id/review-field` (`super_admin` or `manager`, `200`)
Review a single field.
Body (`ReviewFieldDto`):
- `field_id: UUID`
- `status: 'not_reviewed' | 'ok' | 'needs_revision'`
- `note?: string`

Response (`200`): `{ success: true, data: <rpc result> }`

### `PATCH /bookings/:id/complete-review` (`super_admin` or `manager`, `200`)
Finish review and set final booking transition.
Body (`CompleteReviewDto`):
- `action: 'approve' | 'reject' | 'request_revision'`
- `notes?: string`

Response (`200`): `{ success: true, data: <rpc result> }`

### `POST /bookings/:id/record-agreement` (`super_admin` or `manager`, `200`)
Record generated agreement metadata.
Body (`RecordAgreementDto`):
- `storage_path: string`
- `file_name: string`
- `size_bytes: number`
- `preview_url?: string`

Response (`200`): `{ success: true, data: <rpc result> }`

### `PATCH /bookings/:id/mark-printed` (`super_admin` or `manager`, `200`)
Mark agreement printed.

Response (`200`): `{ success: true, data: { success: true } }`

### `PATCH /bookings/:id/cancel` (`super_admin` or `manager`, `200`)
Cancel booking.
Body (`CancelBookingDto`):
- `reason: string`
- `is_allottee_cancel: boolean`

Response (`200`): `{ success: true, data: <booking row> }`

### `PATCH /bookings/:id/possession` (`super_admin` or `manager`, `200`)
Possession tracking.
Body (`PossessionDto`):
- `oc_date?: string` (date string)
- `possession_offered_at?: string` (date string)
- `possession_taken_at?: string` (date string)

Response (`200`): `{ success: true, data: <booking row> }`

### `PATCH /bookings/:id/registration` (`super_admin` or `manager`, `200`)
Mark registration completion.
Body (`RegistrationDto`):
- `sale_deed_registered_at: string` (date string)
- `stamp_duty_amount?: number`
- `registration_charges?: number`

Response (`200`): `{ success: true, data: <booking row> }`

### `GET /bookings/:id`
Booking detail.

Response (`200`): `{ success: true, data: bookingRow }`

### `PATCH /bookings/:id`
Update draft/revision communication fields.
Body (`UpdateBookingDto`):
- `allottee_address?: string`
- `allottee_phone?: string`
- `allottee_email?: string`
- `agent_name?: string`
- `agent_rera_no?: string`
- `agent_represented_by?: string`
- `agent_contact_no?: string`
- `agent_email?: string`
- `fund_source?: string`
- `home_loan_pct?: number` (min 0, max 100)
- `notes?: string`

Response (`200`): `{ success: true, data: <booking row> }`

## 10) Field Values

All routes below require `Authorization`.

### `GET /field-values/:bookingId`
Get booking field values map keyed by `field_key`.

Response (`200`): `{ success: true, data: { [field_key]: valueRow } }`

### `PUT /field-values/:bookingId/bulk` (`200`)
Bulk upsert field values.
Body (`BulkFieldValuesDto`):
- `values: BulkFieldValueItem[]` (min 1, max 50)

Bulk item (`BulkFieldValueItem`):
- `field_id: UUID`
- exactly one of:
  - `value_text?: string`
  - `value_number?: number`
  - `value_date?: string` (date string)
  - `value_boolean?: boolean`
- `value_json?: object` (optional, upsertable)

Response (`200`): `{ success: true, data: { count: number } }`

### `PUT /field-values/:bookingId/:fieldId` (`200`)
Upsert a single field value.
Body (`UpsertFieldValueDto`):
- one of:
  - `value_text?: string`
  - `value_number?: number`
  - `value_date?: string` (date string)
  - `value_boolean?: boolean`
- `value_json?: Record<string, unknown>`

Response (`200`): `{ success: true, data: booking_field_value_row }`

## 11) Documents

All routes below require `Authorization`.

### `GET /documents`
List documents.
Query (`QueryDocumentsDto`):
- `page`, `limit`
- `booking_id?: UUID`
- `type?: DocType` (one of the `DocType` enum)
- `is_verified?: boolean`

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `POST /documents/upload` (`201`)
Upload a document as `multipart/form-data`.
Consumes: `multipart/form-data`

Expected multipart fields:
- `booking_id: string` (required)
- `type: string` (required, `DocType`)
- `allottee_index?: number` (defaults to `0`)
- `notes?: string`
- `file: binary` (required file part)

Response (`201`): `{ success: true, data: <document row> }`

### `GET /documents/:id/signed-url`
Fetch a fresh signed URL payload.

Response (`200`): `{ success: true, data: { url, ... } }`

### `GET /documents/:id`
Fetch document metadata.

Response (`200`): `{ success: true, data: <document row> }`

### `DELETE /documents/:id`
Delete a document (and underlying storage object).

Response (`200`): `{ success: true, data: ... }`

### `PATCH /documents/:id/verify` (`200`)
Verify or reject a document.
Body (`VerifyDocumentDto`):
- `is_verified: boolean`
- `rejection_reason?: string`

Response (`200`): `{ success: true, data: ... }`

## 12) Notifications

All routes below require `Authorization`.

### `GET /notifications` (`200`)
List notifications for the current user.
Query:
- `page`, `limit`
- `is_read?: boolean`, provided as query string `true|false`

Response (`200`): `{ success: true, data: [...], meta: {...} }`

### `PATCH /notifications/mark-all-read` (`200`)
Mark all notifications read for current user.

Response (`200`): `{ success: true, data: { count: number } }`

### `PATCH /notifications/:id/read` (`200`)
Mark a single notification read.

Response (`200`): `{ success: true, data: { success: true } }`

### `POST /notifications` (`201`) (`super_admin` or `manager`)
Create notification.
Body (`CreateNotificationDto`):
- `user_id: UUID` (required)
- `booking_id?: UUID`
- `type: string` (required)
- `title: string` (required)
- `body: string` (required)
- `action_url?: string`
- `metadata?: object`

Response (`201`): `{ success: true, data: <notification row> }`

## 13) Agreement Templates

All endpoints require `Authorization`.

### `GET /agreement-templates` (`super_admin` or `manager`)
List agreement templates (without `body_html` in rows).
Query (`QueryAgreementTemplatesDto`):
- `page`, `limit`
- `project_id?: UUID`
- `is_active?: boolean`

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `GET /agreement-templates/:id` (`super_admin` or `manager`)
Get full template.

Response (`200`): `{ success: true, data: <template incl. body_html> }`

### `POST /agreement-templates` (`super_admin`)
Create agreement template.
Body (`CreateAgreementTemplateDto`):
- `project_id: UUID`
- `name: string`
- `description?: string`
- `body_html: string`
- `header_html?: string`
- `footer_html?: string`
- `page_size?: string` (default `'A4'`)
- margins:
  - `margin_top?: number`
  - `margin_bottom?: number`
  - `margin_left?: number`
  - `margin_right?: number`
- `is_active?: boolean`

Response (`201`): `{ success: true, data: ... }`

### `PATCH /agreement-templates/:id` (`super_admin`)
Update agreement template.
Body (`UpdateAgreementTemplateDto`): partial of `CreateAgreementTemplateDto`

Response (`200`): `{ success: true, data: ... }`

### `DELETE /agreement-templates/:id` (`super_admin`)
Delete unused agreement template.

Response (`200`): `{ success: true, data: ... }`

## 14) Form Templates

All endpoints require `Authorization`.

### `GET /form-templates`
List form templates.
Query (`QueryFormTemplatesDto`):
- `page`, `limit`
- `project_id?: UUID`
- `is_active?: boolean`

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `POST /form-templates` (`super_admin`)
Create template.
Body (`CreateTemplateDto`):
- `project_id: UUID`
- `name: string`
- `description?: string`

Response (`201`): `{ success: true, data: ... }`

### `GET /form-templates/:id/sections`
List sections for a template.
Response (`200`): `{ success: true, data: [...], meta: { total: ... } }`

### `POST /form-templates/:id/sections` (`super_admin`)
Create section.
Body (`CreateSectionDto`):
- `section_label: string`
- `section_key?: string`
- `display_order?: number` (int, min 0)
- `is_active?: boolean`

Response (`201`): `{ success: true, data: ... }`

### `PATCH /form-templates/:id/sections/:sectionId` (`super_admin`)
Update section.
Body (`PatchSectionDto`): partial of `CreateSectionDto`

Response (`200`): `{ success: true, data: ... }`

### `DELETE /form-templates/:id/sections/:sectionId` (`super_admin`)
Delete section and fields.

Response (`200`): `{ success: true, data: { success: true } }`

### `GET /form-templates/:id/fields`
List fields for a template section.
Query (`QueryFieldsDto`):
- `page`, `limit`
- `section_id?: UUID`
- `is_active?: boolean`
- `visible_to_user?: boolean`

Response (`200`): `{ success: true, data: [...], meta?: {...} }`

### `POST /form-templates/:id/fields` (`super_admin`)
Create field.
Body (`CreateFieldDto`):
- `section_id: UUID`
- `field_key: string` (snake_case, regex `^[a-z][a-z0-9_]+$`)
- `field_label: string`
- `data_type: FieldDataType` enum
- optional flags:
  - `is_required?: boolean`
  - `visible_to_user?: boolean`
  - `editable_by_user?: boolean`
  - `visible_to_manager?: boolean`
  - `editable_by_manager?: boolean`
- `display_order?: number` (int, min 0)
- `placeholder?: string`
- `help_text?: string`
- `validation_regex?: string`
- `options?: string[]` (for select/multiselect)
- `default_value?: string`
- file constraints:
  - `max_file_size_mb?: number` (int, min 1..100)
  - `accepted_file_types?: string[]` (max 50)

Response (`201`): `{ success: true, data: ... }`

### `PATCH /form-templates/:id/fields/reorder` (`super_admin`)
Reorder fields.
Body (`ReorderFieldsDto`):
- `fields: { id: UUID, display_order: number }[]`

Response (`200`): `{ success: true, data: ... }`

### `PATCH /form-templates/:id/fields/:fieldId/toggle` (`super_admin`)
Toggle field flags.
Body (`ToggleFieldDto`):
- `visible_to_user?: boolean`
- `editable_by_user?: boolean`
- `is_active?: boolean`

Response (`200`): `{ success: true, data: ... }`

### `PATCH /form-templates/:id/fields/:fieldId` (`super_admin`)
Update field metadata.
Body (`UpdateFieldDto`): partial of `CreateFieldDto` (excluding immutable `field_key`)

Response (`200`): `{ success: true, data: ... }`

### `DELETE /form-templates/:id/fields/:fieldId` (`super_admin`)
Delete custom field.

Response (`200`): `{ success: true, data: { success: true } }`

### `GET /form-templates/:id`
Get template with nested sections/fields.

Response (`200`): `{ success: true, data: {...} }`

### `PATCH /form-templates/:id` (`super_admin`)
Patch template metadata.
Body (`PatchTemplateDto`):
- `name?: string`
- `description?: string`
- `is_active?: boolean`

Response (`200`): `{ success: true, data: ... }`

### `DELETE /form-templates/:id` (`super_admin`)
Delete unused template.

Response (`200`): `{ success: true, data: ... }`

## 15) Payments

All endpoints below require `Authorization`.

### `GET /payments/collections` (`super_admin` or `manager`)
Monthly cleared collections.
Query (`CollectionsQueryDto`):
- `year?: number` (2000..2100)
- `project_id?: UUID`
- `month?: number` (1..12)

Response (`200`): `{ success: true, data: ... }`

### `GET /payments/booking/:bookingId`
Payment summary for a booking.

Response (`200`): `{ success: true, data: { payments?: [...], summary?: {...} } }`

### `GET /payments`
List payments with optional filters.
Query (`QueryPaymentsDto`):
- pagination: `page`, `limit`
- `booking_id?: UUID`
- `status?: 'pending' | 'demanded' | 'received' | 'cleared' | 'bounced' | 'refunded'`
- `project_id?: UUID`
- `milestone?: PaymentMilestone` (see DTO for enum list)

Response (`200`): `{ success: true, data: [...], meta: {...} }`

### `GET /payments/:id`
Payment detail.

Response (`200`): `{ success: true, data: ... }`

### `PATCH /payments/:id/record` (`super_admin` or `manager`)
Record receipt.
Body (`RecordPaymentDto`):
- `amount_paid: number`
- `payment_method: 'cheque' | 'demand_draft' | 'wire_transfer' | 'upi' | 'neft' | 'rtgs'`
- `cheque_no?: string`
- `upi_txn_no?: string`
- `bank_name?: string`
- `drawn_on?: string`
- `paid_at?: string` (date string)
- `tds_deducted?: number`
- `tds_form_16b?: string`
- `notes?: string`

Response (`200`): `{ success: true, data: ... }`

### `PATCH /payments/:id/clear` (`super_admin` or `manager`)
Mark cleared.

Response (`200`): `{ success: true, data: ... }`

### `PATCH /payments/:id/bounce` (`super_admin` or `manager`)
Mark bounced + apply fee.

Response (`200`): `{ success: true, data: ... }`

### `PATCH /payments/:id/demand` (`super_admin` or `manager`)
Demand payment + notify.
Body (`DemandPaymentDto`):
- `due_date: string` (date)
- `notice_number: 1 | 2`

Response (`200`): `{ success: true, data: ... }`

### `PATCH /payments/:id/interest` (`super_admin` or `manager`)
Apply interest terms.
Body (`InterestDto`):
- `interest_rate: number`
- `interest_amount: number`
- `interest_from_date: string` (date)

Response (`200`): `{ success: true, data: ... }`

## 16) Health / Other Routes
If the repo has any additional non-controller routes (webhooks, internal health checks), they are not included in this file because this documentation is generated from Nest controllers present under `src/**`.

## Appendix A - Practical Examples

### Login
```bash
curl -sX POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"user1234"}'
```

### Authenticated request
```bash
curl -sX GET "http://localhost:3000/api/v1/projects?page=1&limit=20" \
  -H "Authorization: Bearer <access_token>"
```

### Document upload (multipart)
```bash
curl -sX POST "http://localhost:3000/api/v1/documents/upload" \
  -H "Authorization: Bearer <access_token>" \
  -F "booking_id=<booking_uuid>" \
  -F "type=aadhar_card" \
  -F "allottee_index=0" \
  -F "notes=optional note" \
  -F "file=@./aadhar.pdf;type=application/pdf"
```

