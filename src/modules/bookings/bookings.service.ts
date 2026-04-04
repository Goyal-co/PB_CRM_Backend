import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CurrentUser } from '@common/types/user.types';
import { BookingStatus } from '@common/types/supabase.types';
import { getBookingForUser } from '@common/utils/access.util';
import { assertBookingStatusTransition } from '@common/utils/booking-status.util';
import { throwFromPostgrest, mapRpcError } from '@common/utils/supabase-errors';
import {
  buildAgreementParamMap,
  mergeAgreementPlaceholders,
  wrapAgreementHtmlDocument,
} from '@common/utils/agreement-merge.util';
import { renderHtmlToPdfBuffer } from '@common/utils/agreement-pdf.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ReviewFieldDto } from './dto/review-field.dto';
import { CompleteReviewDto } from './dto/complete-review.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { PossessionDto } from './dto/possession.dto';
import { RegistrationDto } from './dto/registration.dto';
import { RecordAgreementDto } from './dto/record-agreement.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  /**
   * Invokes a Postgres RPC with the caller's JWT so `auth.uid()`, `is_manager_or_above()`,
   * and other role checks behave correctly (service-role clients leave `auth.uid()` null).
   */
  private async rpcAsUser<T>(
    accessToken: string,
    rpcName: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const client = await this.supabase.getUserClient(accessToken);
    const { data, error } = await client.rpc(rpcName, params);
    if (error) {
      mapRpcError(error, `${rpcName} failed`);
    }
    return data as T;
  }

  /** Resolves all projects a manager can operate on. */
  private async managerProjectIds(managerId: string): Promise<string[]> {
    const { data, error } = await this.admin()
      .from('manager_projects')
      .select('project_id')
      .eq('manager_id', managerId);
    if (error) {
      throwFromPostgrest(error, 'MANAGER_PROJECTS_FAILED');
    }
    return (data as { project_id: string }[] | null)?.map((r) => r.project_id) ?? [];
  }

  /** Persists immutable audit trail rows for lifecycle transparency. */
  private async logBookingStatusChange(
    userId: string,
    bookingId: string,
    oldStatus: BookingStatus,
    newStatus: BookingStatus,
  ): Promise<void> {
    const { error } = await this.admin().from('audit_logs').insert({
      user_id: userId,
      booking_id: bookingId,
      action: 'BOOKING_STATUS_CHANGED',
      entity: 'bookings',
      entity_id: bookingId,
      old_value: { status: oldStatus },
      new_value: { status: newStatus },
    });
    if (error) {
      throwFromPostgrest(error, 'AUDIT_INSERT_FAILED');
    }
  }

  /**
   * Applies tenant filters for `v_booking_list` so each role sees the correct slice.
   */
  async list(
    user: CurrentUser,
    q: QueryBookingsDto,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;
    let query = this.admin()
      .from('v_booking_list')
      .select('*', { count: 'exact' });

    if (user.role === 'user') {
      query = query.eq('user_id', user.id);
    } else if (user.role === 'manager') {
      const pids = await this.managerProjectIds(user.id);
      const ors = [`assigned_manager_id.eq.${user.id}`];
      if (pids.length) {
        ors.push(`project_id.in.(${pids.join(',')})`);
      }
      query = query.or(ors.join(','));
    }

    if (q.project_id) {
      query = query.eq('project_id', q.project_id);
    }
    if (q.status) {
      query = query.eq('status', q.status);
    }
    if (q.assigned_manager_id) {
      query = query.eq('assigned_manager_id', q.assigned_manager_id);
    }
    if (q.tower) {
      query = query.eq('tower', q.tower);
    }
    if (q.unit_type) {
      query = query.eq('unit_type', q.unit_type);
    }
    if (q.search?.trim()) {
      const t = `%${q.search.trim()}%`;
      query = query.or(
        `application_no.ilike.${t},allottee_phone.ilike.${t},allottee_name.ilike.${t}`,
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'BOOKING_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  /**
   * Booking list scoped to the caller's projects (`get_bookings_for_my_projects` RPC).
   */
  async workspaceForCaller(
    accessToken: string,
    q: {
      status?: string;
      project_id?: string;
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<unknown> {
    const client = await this.supabase.getUserClient(accessToken);
    const offset = (q.page - 1) * q.limit;
    const { data, error } = await client.rpc('get_bookings_for_my_projects', {
      p_status: q.status ?? null,
      p_project_id: q.project_id ?? null,
      p_limit: q.limit,
      p_offset: offset,
      p_search: q.search ?? null,
    });
    if (error) {
      mapRpcError(error, 'get_bookings_for_my_projects failed');
    }
    return data;
  }

  /**
   * Queue of bookings waiting for manager review.
   */
  async pendingReview(
    user: CurrentUser,
  ): Promise<{ data: unknown[]; meta: { total: number } }> {
    if (user.role !== 'manager' && user.role !== 'super_admin') {
      throw new ForbiddenException({ message: 'Forbidden', error: 'FORBIDDEN' });
    }
    let q = this.admin()
      .from('v_booking_list')
      .select('*')
      .eq('status', 'submitted')
      .order('updated_at', { ascending: true });
    if (user.role === 'manager') {
      const pids = await this.managerProjectIds(user.id);
      const ors = [`assigned_manager_id.eq.${user.id}`];
      if (pids.length) {
        ors.push(`project_id.in.(${pids.join(',')})`);
      }
      q = q.or(ors.join(','));
    }
    const { data, error } = await q;
    if (error) {
      throwFromPostgrest(error, 'PENDING_REVIEW_FAILED');
    }
    const rows = data ?? [];
    return { data: rows, meta: { total: rows.length } };
  }

  /**
   * Loads raw booking row with RBAC enforced.
   */
  async findOne(
    user: CurrentUser,
    id: string,
  ): Promise<Record<string, unknown>> {
    return getBookingForUser(this.supabase, user, id) as Promise<
      Record<string, unknown>
    >;
  }

  /**
   * Hydrates booking form structure via Supabase RPC.
   */
  async getForm(
    user: CurrentUser,
    bookingId: string,
    accessToken: string,
  ): Promise<unknown> {
    await this.findOne(user, bookingId);
    return this.rpcAsUser<unknown>(accessToken, 'get_booking_form', {
      p_booking_id: bookingId,
    });
  }

  /**
   * Creates a draft booking only when inventory is genuinely available.
   */
  async create(
    user: CurrentUser,
    dto: CreateBookingDto,
  ): Promise<Record<string, unknown>> {
    // Idempotency guard: UI double-submits can race and trigger 409 after the first insert
    // (e.g., DB triggers may mark the unit unavailable immediately).
    const { data: existing, error: exErr } = await this.admin()
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .eq('unit_id', dto.unit_id)
      .in('status', ['draft', 'revision_requested'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exErr) {
      throwFromPostgrest(exErr, 'BOOKING_LOOKUP_FAILED');
    }
    if (existing) {
      return existing as Record<string, unknown>;
    }

    const { data: unit, error: uErr } = await this.admin()
      .from('units')
      .select('id, status, is_blocked, project_id')
      .eq('id', dto.unit_id)
      .maybeSingle();
    if (uErr) {
      throwFromPostgrest(uErr, 'UNIT_LOOKUP_FAILED');
    }
    if (!unit) {
      throw new NotFoundException({
        message: 'Unit not found',
        error: 'UNIT_NOT_FOUND',
      });
    }
    const u = unit as {
      status: string;
      is_blocked?: boolean | null;
      project_id: string;
    };
    if (u.status !== 'available') {
      throw new ConflictException({
        message: 'Unit is not available',
        error: 'UNIT_NOT_AVAILABLE',
      });
    }
    if (u.is_blocked === true) {
      throw new ConflictException({
        message: 'Unit is not available',
        error: 'UNIT_BLOCKED',
      });
    }
    if (u.project_id !== dto.project_id) {
      throw new BadRequestException({
        message: 'Unit does not belong to project',
        error: 'PROJECT_MISMATCH',
      });
    }

    const fundSource = dto.fund_source ?? 'home_loan';
    const homeLoanPct =
      dto.home_loan_pct !== undefined && dto.home_loan_pct !== null
        ? dto.home_loan_pct
        : fundSource === 'home_loan'
          ? 80
          : null;
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      project_id: dto.project_id,
      unit_id: dto.unit_id,
      form_template_id: dto.form_template_id,
      agreement_template_id: dto.agreement_template_id,
      joint_allottees: dto.joint_allottees ?? null,
      // DB constraint: field_snapshot is NOT NULL in some deployments.
      // Initialize to empty object; the submit RPC can later populate/refresh it.
      field_snapshot: {},
      allottee_address:
        dto.allottee_address ??
        '12 Test Road, Indiranagar, Bengaluru 560038',
      allottee_phone: dto.allottee_phone ?? '9876543210',
      allottee_email: dto.allottee_email ?? 'user-test@orchidlife.in',
      agent_name: dto.agent_name ?? null,
      agent_rera_no: dto.agent_rera_no ?? null,
      agent_represented_by: dto.agent_represented_by ?? null,
      agent_contact_no: dto.agent_contact_no ?? null,
      agent_email: dto.agent_email ?? null,
      fund_source: fundSource,
      home_loan_pct: homeLoanPct,
      notes: dto.notes ?? null,
      status: 'draft',
    };

    const { data, error } = await this.admin()
      .from('bookings')
      .insert(insertPayload)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'BOOKING_CREATE_FAILED');
    }
    return data as Record<string, unknown>;
  }

  /**
   * Patches communication and broker details during editable statuses.
   */
  async update(
    user: CurrentUser,
    id: string,
    dto: UpdateBookingDto,
  ): Promise<Record<string, unknown>> {
    const booking = await this.findOne(user, id);
    const status = booking.status as BookingStatus;
    if (!['draft', 'revision_requested'].includes(status)) {
      throw new BadRequestException({
        message: 'Booking not editable in current status',
        error: 'BOOKING_NOT_EDITABLE',
      });
    }
    if (
      user.role === 'user' &&
      (booking.user_id as string) !== user.id
    ) {
      throw new ForbiddenException({
        message: 'Cannot update this booking',
        error: 'FORBIDDEN',
      });
    }

    const { data, error } = await this.admin()
      .from('bookings')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'BOOKING_UPDATE_FAILED');
    }
    return data as Record<string, unknown>;
  }

  /**
   * Runs `submit_booking` RPC then nudges the owning manager.
   */
  async submit(
    user: CurrentUser,
    bookingId: string,
    accessToken: string,
  ): Promise<unknown> {
    if (user.role !== 'user') {
      throw new ForbiddenException({
        message: 'Only the allottee can submit a booking application',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    if ((booking.user_id as string) !== user.id) {
      throw new ForbiddenException({
        message: 'Only owner can submit',
        error: 'FORBIDDEN',
      });
    }

    // Defensive backfill for older rows created before field_snapshot became NOT NULL.
    if (booking.field_snapshot == null) {
      const { error: snapErr } = await this.admin()
        .from('bookings')
        .update({ field_snapshot: {}, updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (snapErr) {
        throwFromPostgrest(snapErr, 'BOOKING_UPDATE_FAILED');
      }
    }

    const data = await this.rpcAsUser<unknown>(accessToken, 'submit_booking', {
      p_booking_id: bookingId,
    });
    const result = data as { success?: boolean; missing_fields?: string[] };
    if (result?.success) {
      const mgrId = booking.assigned_manager_id as string | null;
      if (mgrId) {
        await this.notifications.notifyUser({
          user_id: mgrId,
          booking_id: bookingId,
          type: 'in_app',
          title: 'Booking submitted',
          body: `Application ${String(booking.application_no ?? bookingId)} submitted for review`,
          action_url: `/bookings/${bookingId}`,
          metadata: { booking_id: bookingId },
        });
      }
    }
    return result;
  }

  /**
   * Moves a booking into review with `start_review` RPC.
   */
  async startReview(
    user: CurrentUser,
    bookingId: string,
    accessToken: string,
  ): Promise<{ success: boolean }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    await this.findOne(user, bookingId);
    await this.rpcAsUser<unknown>(accessToken, 'start_review', {
      p_booking_id: bookingId,
    });
    return { success: true };
  }

  /**
   * Records per-field review feedback via `review_field` RPC.
   */
  async reviewField(
    user: CurrentUser,
    bookingId: string,
    dto: ReviewFieldDto,
    accessToken: string,
  ): Promise<{ success: boolean }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    await this.findOne(user, bookingId);
    await this.rpcAsUser<unknown>(accessToken, 'review_field', {
      p_booking_id: bookingId,
      p_field_id: dto.field_id,
      p_status: dto.status,
      p_note: dto.note ?? null,
    });
    return { success: true };
  }

  /**
   * Finalises review stage and fans out notifications for the outcome.
   */
  async completeReview(
    user: CurrentUser,
    bookingId: string,
    dto: CompleteReviewDto,
    accessToken: string,
  ): Promise<unknown> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const before = await this.findOne(user, bookingId);
    if (dto.action === 'approve') {
      const { data: needRev, error: revErr } = await this.admin()
        .from('field_reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('review_status', 'needs_revision')
        .limit(1);
      if (revErr) {
        throwFromPostgrest(revErr, 'FIELD_REVIEW_CHECK_FAILED');
      }
      if ((needRev as unknown[] | null)?.length) {
        throw new UnprocessableEntityException({
          message:
            'Resolve field reviews marked as needing revision before approving',
          error: 'FIELDS_NEED_REVISION',
        });
      }
    }
    const data = await this.rpcAsUser<unknown>(accessToken, 'complete_review', {
      p_booking_id: bookingId,
      p_action: dto.action,
      p_notes: dto.notes ?? null,
    });
    const rpcResult = data as { success?: boolean } | null;
    const ownerId = before.user_id as string;
    if (dto.action === 'request_revision') {
      await this.notifications.notifyUser({
        user_id: ownerId,
        booking_id: bookingId,
        type: 'in_app',
        title: 'Revision requested',
        body: 'Your booking requires updates. Please review manager notes.',
        action_url: `/bookings/${bookingId}`,
        metadata: { booking_id: bookingId },
      });
    } else if (
      dto.action === 'approve' &&
      rpcResult &&
      typeof rpcResult === 'object' &&
      rpcResult.success !== false
    ) {
      await this.notifications.notifyUser({
        user_id: ownerId,
        booking_id: bookingId,
        type: 'in_app',
        title: 'Booking approved',
        body: 'Your booking has been approved.',
        action_url: `/bookings/${bookingId}`,
      });
    }
    return data;
  }

  /**
   * Returns merged agreement HTML for approved bookings (template + booking/unit/project/profile + field_snapshot).
   */
  async mergedAgreement(
    user: CurrentUser,
    bookingId: string,
    _accessToken: string,
  ): Promise<unknown> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    if ((booking.status as string) !== 'approved') {
      throw new UnprocessableEntityException({
        message: 'Booking must be approved',
        error: 'BOOKING_NOT_APPROVED',
      });
    }
    return this.buildMergedAgreementPayload(bookingId, booking);
  }

  /**
   * Merged agreement as HTML bytes (`?format=html` download).
   */
  async agreementDownloadHtml(
    user: CurrentUser,
    bookingId: string,
  ): Promise<Buffer> {
    const { html } = await this.agreementDownloadContext(user, bookingId);
    return Buffer.from(html, 'utf-8');
  }

  /**
   * Merged agreement as PDF (default download).
   */
  async agreementDownloadPdf(
    user: CurrentUser,
    bookingId: string,
  ): Promise<Buffer> {
    const { html, pdfCacheKey } = await this.agreementDownloadContext(
      user,
      bookingId,
    );
    return renderHtmlToPdfBuffer(html, { cacheKey: pdfCacheKey });
  }

  /**
   * Shared validation + merge for agreement downloads (HTML / PDF).
   */
  private async agreementDownloadContext(
    user: CurrentUser,
    bookingId: string,
  ): Promise<{ html: string; pdfCacheKey: string }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    if ((booking.status as string) !== 'approved') {
      throw new UnprocessableEntityException({
        message: 'Booking must be approved',
        error: 'BOOKING_NOT_APPROVED',
      });
    }
    const payload = (await this.buildMergedAgreementPayload(
      bookingId,
      booking,
    )) as {
      merged_html: string;
      header_html?: string | null;
      footer_html?: string | null;
    };
    const html = wrapAgreementHtmlDocument({
      header_html: payload.header_html,
      body_html: payload.merged_html,
      footer_html: payload.footer_html,
    });
    const pdfCacheKey = [
      'v1',
      bookingId,
      String(
        (booking as { updated_at?: string | null }).updated_at ??
          (booking as { created_at?: string | null }).created_at ??
          '',
      ),
      String(booking.agreement_template_id ?? ''),
    ].join(':');
    return { html, pdfCacheKey };
  }

  private async buildMergedAgreementPayload(
    bookingId: string,
    booking: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const templateId = booking.agreement_template_id as string | undefined;
    if (!templateId) {
      throw new UnprocessableEntityException({
        message: 'Booking has no agreement template',
        error: 'AGREEMENT_TEMPLATE_MISSING',
      });
    }

    const unitId = booking.unit_id as string;
    const projectId = booking.project_id as string;
    const userId = booking.user_id as string;

    const [templateResult, unitRes, projectRes, profileRes] = await Promise.all(
      [
        this.admin()
          .from('agreement_templates')
          .select('*')
          .eq('id', templateId)
          .maybeSingle(),
        this.admin().from('units').select('*').eq('id', unitId).maybeSingle(),
        this.admin()
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .maybeSingle(),
        this.admin()
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
      ],
    );

    const { data: template, error: tErr } = templateResult;
    if (tErr) {
      throwFromPostgrest(tErr, 'AGREEMENT_TEMPLATE_LOAD_FAILED');
    }
    if (!template) {
      throw new NotFoundException({
        message: 'Agreement template not found',
        error: 'AGREEMENT_TEMPLATE_NOT_FOUND',
      });
    }
    if (unitRes.error) {
      throwFromPostgrest(unitRes.error, 'UNIT_LOAD_FAILED');
    }
    if (projectRes.error) {
      throwFromPostgrest(projectRes.error, 'PROJECT_LOAD_FAILED');
    }
    if (profileRes.error) {
      throwFromPostgrest(profileRes.error, 'PROFILE_LOAD_FAILED');
    }

    const params = buildAgreementParamMap({
      booking,
      unit: unitRes.data as Record<string, unknown> | null,
      project: projectRes.data as Record<string, unknown> | null,
      profile: profileRes.data as Record<string, unknown> | null,
    });

    const t = template as Record<string, unknown>;
    const bodyHtml = mergeAgreementPlaceholders(String(t.body_html ?? ''), params);
    const headerRaw = t.header_html as string | null | undefined;
    const footerRaw = t.footer_html as string | null | undefined;

    return {
      booking_id: bookingId,
      agreement_template_id: templateId,
      merged_html: bodyHtml,
      header_html: headerRaw
        ? mergeAgreementPlaceholders(headerRaw, params)
        : null,
      footer_html: footerRaw
        ? mergeAgreementPlaceholders(footerRaw, params)
        : null,
      page_size: t.page_size ?? 'A4',
      margin_top: t.margin_top ?? null,
      margin_bottom: t.margin_bottom ?? null,
      margin_left: t.margin_left ?? null,
      margin_right: t.margin_right ?? null,
    };
  }

  /**
   * Persists generated agreement metadata through RPC.
   */
  async recordAgreement(
    user: CurrentUser,
    bookingId: string,
    dto: RecordAgreementDto,
    accessToken: string,
  ): Promise<unknown> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    if ((booking.status as string) !== 'approved') {
      throw new UnprocessableEntityException({
        message: 'Booking must be approved',
        error: 'BOOKING_NOT_APPROVED',
      });
    }
    const data = await this.rpcAsUser<string | null>(
      accessToken,
      'record_agreement_generated',
      {
        p_booking_id: bookingId,
        p_storage_path: dto.storage_path,
        p_file_name: dto.file_name,
        p_size_bytes: dto.size_bytes,
        p_preview_url: dto.preview_url ?? null,
      },
    );
    const ownerId = booking.user_id as string;
    await this.notifications.notifyUser({
      user_id: ownerId,
      booking_id: bookingId,
      type: 'in_app',
      title: 'Agreement generated',
      body: 'Your agreement document is ready for download.',
      action_url: `/bookings/${bookingId}`,
    });
    return { document_id: data };
  }

  /**
   * Marks agreement as printed for compliance checkpoints.
   */
  async markPrinted(
    user: CurrentUser,
    bookingId: string,
    accessToken: string,
  ): Promise<{ success: boolean }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    if ((booking.status as string) !== 'agreement_generated') {
      throw new UnprocessableEntityException({
        message: 'Agreement must be generated before marking printed',
        error: 'INVALID_BOOKING_STATUS',
      });
    }
    await this.rpcAsUser<unknown>(accessToken, 'mark_agreement_printed', {
      p_booking_id: bookingId,
    });
    return { success: true };
  }

  /**
   * Cancels booking and relies on database triggers to free inventory.
   */
  async cancel(
    user: CurrentUser,
    bookingId: string,
    dto: CancelBookingDto,
  ): Promise<Record<string, unknown>> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    const oldStatus = booking.status as BookingStatus;
    assertBookingStatusTransition(oldStatus, 'cancelled');
    const { data, error } = await this.admin()
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: dto.reason,
        is_allottee_cancel: dto.is_allottee_cancel,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'BOOKING_CANCEL_FAILED');
    }
    await this.logBookingStatusChange(
      user.id,
      bookingId,
      oldStatus,
      'cancelled',
    );
    return data as Record<string, unknown>;
  }

  /**
   * Tracks possession milestones on the booking record.
   */
  async possession(
    user: CurrentUser,
    bookingId: string,
    dto: PossessionDto,
  ): Promise<Record<string, unknown>> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    await this.findOne(user, bookingId);
    const { data, error } = await this.admin()
      .from('bookings')
      .update({
        oc_date: dto.oc_date ?? null,
        possession_offered_at: dto.possession_offered_at ?? null,
        possession_taken_at: dto.possession_taken_at ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'POSSESSION_UPDATE_FAILED');
    }
    return data as Record<string, unknown>;
  }

  /**
   * Final registration step including statutory fee captures.
   */
  async registration(
    user: CurrentUser,
    bookingId: string,
    dto: RegistrationDto,
  ): Promise<Record<string, unknown>> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Managers only',
        error: 'FORBIDDEN',
      });
    }
    const booking = await this.findOne(user, bookingId);
    const oldStatus = booking.status as BookingStatus;
    assertBookingStatusTransition(oldStatus, 'registered');
    const { data, error } = await this.admin()
      .from('bookings')
      .update({
        status: 'registered',
        sale_deed_registered_at: dto.sale_deed_registered_at,
        stamp_duty_amount: dto.stamp_duty_amount ?? null,
        registration_charges: dto.registration_charges ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'REGISTRATION_UPDATE_FAILED');
    }
    await this.logBookingStatusChange(
      user.id,
      bookingId,
      oldStatus,
      'registered',
    );
    return data as Record<string, unknown>;
  }
}
