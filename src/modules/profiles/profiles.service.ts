import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser, UserRole } from '@common/types/user.types';
import { mapRpcError, throwFromPostgrest } from '@common/utils/supabase-errors';
import { managerManagesUser } from '@common/utils/access.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns the authenticated user's profile row.
   * Uses the service client scoped by JWT user id (same as SupabaseAuthGuard), not RLS-scoped anon queries.
   */
  async getMe(accessToken: string): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(accessToken);
    if (userErr || !user) {
      throw new ForbiddenException({
        message: 'Unable to resolve user',
        error: 'AUTH_FAILED',
      });
    }
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) {
      throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
    }
    return data;
  }

  /**
   * Updates the caller's profile; role changes are ignored at DB level.
   */
  async updateMe(
    accessToken: string,
    dto: UpdateProfileDto,
  ): Promise<unknown> {
    const admin = this.supabase.supabaseAdmin;
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(accessToken);
    if (userErr || !user) {
      throw new ForbiddenException({
        message: 'Unable to resolve user',
        error: 'AUTH_FAILED',
      });
    }
    const { role: _r, ...safe } = dto as UpdateProfileDto & { role?: unknown };
    void _r;
    const { data, error } = await admin
      .from('profiles')
      .update({ ...safe, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PROFILE_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Paginated profile directory for super admins.
   */
  async findAll(query: {
    page: number;
    limit: number;
    role?: UserRole;
    is_active?: boolean;
    search?: string;
  }): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const admin = this.supabase.supabaseAdmin;
    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;
    let qb = admin.from('profiles').select('*', { count: 'exact' });
    if (query.role) {
      qb = qb.eq('role', query.role);
    }
    if (query.is_active !== undefined) {
      qb = qb.eq('is_active', query.is_active);
    }
    if (query.search?.trim()) {
      const s = `%${query.search.trim()}%`;
      qb = qb.or(
        `first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s}`,
      );
    }
    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'PROFILES_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  /**
   * Fetches a single profile with role checks for managers.
   */
  async findOne(
    current: CurrentUser,
    id: string,
  ): Promise<unknown> {
    if (current.role === 'super_admin') {
      const { data, error } = await this.supabase.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
      }
      if (!data) {
        throw new NotFoundException({
          message: 'Profile not found',
          error: 'PROFILE_NOT_FOUND',
        });
      }
      return data;
    }
    if (current.role === 'manager') {
      if (current.id === id) {
        const { data, error } = await this.supabase.supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) {
          throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
        }
        return data;
      }
      const allowed = await managerManagesUser(
        this.supabase,
        current.id,
        id,
      );
      if (!allowed) {
        throw new ForbiddenException({
          message: 'Cannot view this profile',
          error: 'FORBIDDEN',
        });
      }
      const { data, error } = await this.supabase.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
      }
      if (!data) {
        throw new NotFoundException({
          message: 'Profile not found',
          error: 'PROFILE_NOT_FOUND',
        });
      }
      return data;
    }
    if (current.id !== id) {
      throw new ForbiddenException({
        message: 'Cannot view this profile',
        error: 'FORBIDDEN',
      });
    }
    const { data, error } = await this.supabase.supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Profile not found',
        error: 'PROFILE_NOT_FOUND',
      });
    }
    return data;
  }

  /**
   * Updates profile role (super_admin only).
   */
  async updateRole(id: string, role: UserRole): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          message: 'Profile not found',
          error: 'PROFILE_NOT_FOUND',
        });
      }
      throwFromPostgrest(error, 'ROLE_UPDATE_FAILED');
    }
    return data;
  }

  /**
   * Assigns a manager to a user profile (`admin_assign_manager_to_user` RPC).
   */
  async assignManager(
    accessToken: string,
    id: string,
    dto: AssignManagerDto,
  ): Promise<unknown> {
    const client = await this.supabase.getUserClient(accessToken);
    const { data, error } = await client.rpc('admin_assign_manager_to_user', {
      p_user_id: id,
      p_manager_id: dto.manager_id,
    });
    if (error) {
      mapRpcError(error, 'admin_assign_manager_to_user failed');
    }
    return data;
  }

  /**
   * Deactivates a user account.
   */
  async deactivate(id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.supabaseAdmin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throwFromPostgrest(error, 'DEACTIVATE_FAILED');
    }
    return { success: true };
  }

  /**
   * Lists managers with their project assignments.
   */
  async listManagers(): Promise<unknown[]> {
    const { data: managers, error } = await this.supabase.supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'manager')
      .eq('is_active', true)
      .order('last_name', { ascending: true });
    if (error) {
      throwFromPostgrest(error, 'MANAGERS_LIST_FAILED');
    }
    const rows = managers ?? [];
    const withProjects: unknown[] = [];
    for (const m of rows as { id: string }[]) {
      const { data: mp, error: mpErr } = await this.supabase.supabaseAdmin
        .from('manager_projects')
        .select('project_id')
        .eq('manager_id', m.id);
      if (mpErr) {
        throwFromPostgrest(mpErr, 'MANAGER_PROJECTS_FAILED');
      }
      withProjects.push({
        ...m,
        project_ids: (mp as { project_id: string }[] | null)?.map(
          (x) => x.project_id,
        ),
      });
    }
    return withProjects;
  }
}
