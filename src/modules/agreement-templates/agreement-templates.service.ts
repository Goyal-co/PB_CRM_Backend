import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { CurrentUser } from '@common/types/user.types';
import { CreateAgreementTemplateDto } from './dto/create-agreement-template.dto';
import { UpdateAgreementTemplateDto } from './dto/update-agreement-template.dto';
import { QueryAgreementTemplatesDto } from './dto/query-agreement-templates.dto';

@Injectable()
export class AgreementTemplatesService {
  constructor(private readonly supabase: SupabaseService) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  /**
   * Returns project IDs the caller can operate on.
   * - super_admin: null (means unrestricted)
   * - manager: manager_projects(manager_id = self)
   * - user: profiles.assigned_manager_id → that manager's manager_projects
   */
  private async projectIdsForUser(user: CurrentUser): Promise<string[] | null> {
    if (user.role === 'super_admin') {
      return null;
    }
    let managerId: string | null = null;
    if (user.role === 'manager') {
      managerId = user.id;
    } else {
      const { data: prof, error: pErr } = await this.admin()
        .from('profiles')
        .select('assigned_manager_id')
        .eq('id', user.id)
        .maybeSingle();
      if (pErr) {
        throwFromPostgrest(pErr, 'PROFILE_LOAD_FAILED');
      }
      managerId = (prof as { assigned_manager_id: string | null } | null)
        ?.assigned_manager_id ?? null;
    }
    if (!managerId) {
      return [];
    }
    const { data: mp, error: mpErr } = await this.admin()
      .from('manager_projects')
      .select('project_id')
      .eq('manager_id', managerId);
    if (mpErr) {
      throwFromPostgrest(mpErr, 'MANAGER_PROJECTS_FAILED');
    }
    return [
      ...new Set(
        (mp as { project_id: string }[] | null)?.map((r) => r.project_id) ?? [],
      ),
    ];
  }

  /**
   * Lists agreement templates without heavy HTML bodies for bandwidth.
   */
  async listForUser(user: CurrentUser, q: QueryAgreementTemplatesDto): Promise<{
    data: unknown[];
    meta: Record<string, number>;
  }> {
    const admin = this.admin();
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;
    let qb = admin
      .from('agreement_templates')
      .select(
        'id, project_id, name, description, version, page_size, margin_top, margin_bottom, margin_left, margin_right, is_active, created_at, updated_at',
        { count: 'exact' },
      );

    const allowedProjectIds = await this.projectIdsForUser(user);
    if (allowedProjectIds && allowedProjectIds.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: q.page, limit: q.limit, totalPages: 1 },
      };
    }
    if (allowedProjectIds) {
      qb = qb.in('project_id', allowedProjectIds);
    }

    if (q.project_id) {
      if (allowedProjectIds && !allowedProjectIds.includes(q.project_id)) {
        // Avoid leaking whether a project exists to unprivileged callers.
        return {
          data: [],
          meta: { total: 0, page: q.page, limit: q.limit, totalPages: 1 },
        };
      }
      qb = qb.eq('project_id', q.project_id);
    }
    if (user.role === 'user') {
      // Users should never see inactive templates.
      qb = qb.eq('is_active', true);
    } else if (q.is_active !== undefined) {
      qb = qb.eq('is_active', q.is_active);
    }
    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'AGREEMENT_TEMPLATES_LIST_FAILED');
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
   * Full template payload including HTML fragments for editing and preview.
   */
  async findOneForUser(user: CurrentUser, id: string): Promise<unknown> {
    const { data, error } = await this.admin()
      .from('agreement_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'AGREEMENT_TEMPLATE_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Agreement template not found',
        error: 'AGREEMENT_TEMPLATE_NOT_FOUND',
      });
    }
    const row = data as { project_id?: string; is_active?: boolean };
    if (user.role === 'user' && row.is_active === false) {
      throw new NotFoundException({
        message: 'Agreement template not found',
        error: 'AGREEMENT_TEMPLATE_NOT_FOUND',
      });
    }
    const allowedProjectIds = await this.projectIdsForUser(user);
    if (allowedProjectIds && row.project_id && !allowedProjectIds.includes(row.project_id)) {
      throw new ForbiddenException({
        message: 'Insufficient role',
        error: 'FORBIDDEN',
      });
    }
    return data;
  }

  /**
   * Inserts a template tied to a project with sensible print defaults.
   */
  async create(dto: CreateAgreementTemplateDto): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('agreement_templates')
      .insert({
        ...dto,
        page_size: dto.page_size ?? 'A4',
        version: 1,
        is_active: dto.is_active ?? true,
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'AGREEMENT_TEMPLATE_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Updates HTML and metadata while bumping semantic version for traceability.
   */
  async update(id: string, dto: UpdateAgreementTemplateDto): Promise<unknown> {
    const { data: current, error: cErr } = await this.supabase.supabaseAdmin
      .from('agreement_templates')
      .select('version')
      .eq('id', id)
      .maybeSingle();
    if (cErr) {
      throwFromPostgrest(cErr, 'AGREEMENT_TEMPLATE_LOAD_FAILED');
    }
    if (!current) {
      throw new NotFoundException({
        message: 'Agreement template not found',
        error: 'AGREEMENT_TEMPLATE_NOT_FOUND',
      });
    }
    const nextVersion =
      ((current as { version: number }).version ?? 0) + 1;
    const { data, error } = await this.supabase.supabaseAdmin
      .from('agreement_templates')
      .update({
        ...dto,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'AGREEMENT_TEMPLATE_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Deletes template when no booking depends on it.
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const { count, error: bErr } = await this.supabase.supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('agreement_template_id', id);
    if (bErr) {
      throwFromPostgrest(bErr, 'BOOKING_CHECK_FAILED');
    }
    if ((count ?? 0) > 0) {
      throw new BadRequestException({
        message: 'Template referenced by bookings',
        error: 'TEMPLATE_IN_USE',
      });
    }
    const { error } = await this.supabase.supabaseAdmin
      .from('agreement_templates')
      .delete()
      .eq('id', id);
    if (error) {
      throwFromPostgrest(error, 'AGREEMENT_TEMPLATE_DELETE_FAILED');
    }
    return { success: true };
  }
}
