import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { assertManagerCanAccessProject } from '@common/utils/access.util';

@Injectable()
export class ProjectsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lists active projects with pagination (service role + role rules; not RLS-scoped anon).
   */
  async findAll(
    user: CurrentUser,
    page: number,
    limit: number,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const admin = this.supabase.supabaseAdmin;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (user.role === 'manager') {
      const { data: mp, error: mpErr } = await admin
        .from('manager_projects')
        .select('project_id')
        .eq('manager_id', user.id);
      if (mpErr) {
        throwFromPostgrest(mpErr, 'PROJECTS_LIST_FAILED');
      }
      const ids = [
        ...new Set(
          (mp as { project_id: string }[] | null)?.map((r) => r.project_id) ??
            [],
        ),
      ];
      if (!ids.length) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 1 },
        };
      }
      const { data, error, count } = await admin
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .in('id', ids)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) {
        throwFromPostgrest(error, 'PROJECTS_LIST_FAILED');
      }
      const total = count ?? 0;
      return {
        data: data ?? [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    const { data, error, count } = await admin
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'PROJECTS_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Returns one active project if visible to the caller (service role + role rules).
   */
  async findOne(user: CurrentUser, id: string): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const { data, error } = await admin
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'PROJECT_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Project not found',
        error: 'PROJECT_NOT_FOUND',
      });
    }
    const row = data as { is_active?: boolean };
    if (row.is_active === false) {
      throw new NotFoundException({
        message: 'Project not found',
        error: 'PROJECT_NOT_FOUND',
      });
    }
    if (user.role === 'super_admin') {
      return data;
    }
    if (user.role === 'user') {
      return data;
    }
    if (user.role === 'manager') {
      await assertManagerCanAccessProject(this.supabase, user, id);
      return data;
    }
    throw new ForbiddenException({
      message: 'Insufficient permissions',
      error: 'FORBIDDEN',
    });
  }

  /**
   * Creates a project (super_admin only — enforced at controller); uses service role.
   */
  async create(dto: CreateProjectDto): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('projects')
      .insert({
        ...dto,
        is_active: true,
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PROJECT_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Updates project fields; partial DTO supported.
   */
  async update(id: string, dto: UpdateProjectDto): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('projects')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          message: 'Project not found',
          error: 'PROJECT_NOT_FOUND',
        });
      }
      throwFromPostgrest(error, 'PROJECT_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Soft-deletes a project by marking it inactive.
   */
  async softDelete(id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.supabaseAdmin
      .from('projects')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throwFromPostgrest(error, 'PROJECT_DELETE_FAILED');
    }
    return { success: true };
  }

  /**
   * Aggregated inventory and booking KPIs for dashboard widgets.
   */
  async stats(
    user: CurrentUser,
    projectId: string,
  ): Promise<Record<string, unknown>> {
    if (user.role === 'manager') {
      await assertManagerCanAccessProject(this.supabase, user, projectId);
    } else if (user.role !== 'super_admin') {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        error: 'FORBIDDEN',
      });
    }

    const admin = this.supabase.supabaseAdmin;

    const { count: totalUnits, error: uErr } = await admin
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (uErr) {
      throwFromPostgrest(uErr, 'UNIT_COUNT_FAILED');
    }

    const statuses = [
      'available',
      'booked',
      'registered',
    ] as const;
    const unitByStatus: Record<string, number> = {};
    for (const s of statuses) {
      const { count, error } = await admin
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', s);
      if (error) {
        throwFromPostgrest(error, 'UNIT_STATUS_COUNT_FAILED');
      }
      unitByStatus[s] = count ?? 0;
    }

    const { count: totalBookings, error: bErr } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (bErr) {
      throwFromPostgrest(bErr, 'BOOKING_COUNT_FAILED');
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count: thisMonthBookings, error: mbErr } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('created_at', startOfMonth.toISOString());
    if (mbErr) {
      throwFromPostgrest(mbErr, 'BOOKING_MONTH_COUNT_FAILED');
    }

    const { data: bookingRows, error: brErr } = await admin
      .from('bookings')
      .select('id')
      .eq('project_id', projectId);
    if (brErr) {
      throwFromPostgrest(brErr, 'BOOKING_IDS_FAILED');
    }
    const bookingIds = (bookingRows as { id: string }[] | null)?.map(
      (r) => r.id,
    ) ?? [];
    let totalCollected = 0;
    if (bookingIds.length) {
      const { data: payments, error: pErr } = await admin
        .from('payments')
        .select('amount_paid')
        .in('booking_id', bookingIds)
        .eq('status', 'cleared');
      if (pErr) {
        throwFromPostgrest(pErr, 'PAYMENT_SUM_FAILED');
      }
      if (Array.isArray(payments)) {
        for (const row of payments as { amount_paid: number | null }[]) {
          totalCollected += Number(row.amount_paid ?? 0);
        }
      }
    }

    return {
      total_units: totalUnits ?? 0,
      available: unitByStatus.available ?? 0,
      booked: unitByStatus.booked ?? 0,
      registered: unitByStatus.registered ?? 0,
      total_bookings: totalBookings ?? 0,
      total_collected: totalCollected,
      this_month_bookings: thisMonthBookings ?? 0,
    };
  }

  /**
   * Assigned projects for the caller (manager / user / super_admin) via DB RPC.
   */
  async getMyProjects(user: CurrentUser, accessToken: string): Promise<unknown> {
    // Prefer the DB RPC when available, but fall back to table reads if the RPC is missing/broken.
    try {
      const client = await this.supabase.getUserClient(accessToken);
      const { data, error } = await client.rpc('get_my_projects');
      if (error) {
        throw error;
      }
      return data;
    } catch (err) {
      // Fallback: derive projects from manager assignments.
      // - managers: projects via manager_projects(manager_id = self)
      // - users: projects via assigned_manager_id → that manager's manager_projects
      // - super_admin: all active projects
      const admin = this.supabase.supabaseAdmin;

      if (user.role === 'super_admin') {
        const { data, error } = await admin
          .from('projects')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) {
          throwFromPostgrest(error, 'PROJECTS_LIST_FAILED');
        }
        return data ?? [];
      }

      let managerId: string | null = null;
      if (user.role === 'manager') {
        managerId = user.id;
      } else {
        const { data: prof, error: pErr } = await admin
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
        // No manager linkage → no assigned projects.
        return [];
      }

      const { data: mp, error: mpErr } = await admin
        .from('manager_projects')
        .select('project_id')
        .eq('manager_id', managerId);
      if (mpErr) {
        throwFromPostgrest(mpErr, 'MANAGER_PROJECTS_FAILED');
      }
      const ids = [
        ...new Set(
          (mp as { project_id: string }[] | null)?.map((r) => r.project_id) ??
            [],
        ),
      ];
      if (!ids.length) {
        return [];
      }

      const { data, error } = await admin
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .in('id', ids)
        .order('created_at', { ascending: false });
      if (error) {
        throwFromPostgrest(error, 'PROJECTS_LIST_FAILED');
      }
      return data ?? [];
    }
  }
}
