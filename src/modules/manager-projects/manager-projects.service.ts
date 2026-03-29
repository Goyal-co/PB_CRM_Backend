import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { CreateManagerProjectDto } from './dto/create-manager-project.dto';

@Injectable()
export class ManagerProjectsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lists manager–project rows with optional filters.
   */
  async list(
    user: CurrentUser,
    managerId?: string,
    projectId?: string,
  ): Promise<unknown[]> {
    if (user.role === 'manager' && user.id !== managerId && managerId) {
      throw new ForbiddenException({
        message: 'Managers may only filter their own assignments',
        error: 'FORBIDDEN',
      });
    }
    let q = this.supabase.supabaseAdmin
      .from('manager_projects')
      .select('*');
    if (user.role === 'manager') {
      q = q.eq('manager_id', user.id);
    } else if (managerId) {
      q = q.eq('manager_id', managerId);
    }
    if (projectId) {
      q = q.eq('project_id', projectId);
    }
    const { data, error } = await q.order('id', { ascending: false });
    if (error) {
      throwFromPostgrest(error, 'MANAGER_PROJECTS_LIST_FAILED');
    }
    return data ?? [];
  }

  /**
   * Creates an assignment after verifying the target profile is a manager.
   */
  async create(dto: CreateManagerProjectDto): Promise<unknown> {
    const { data: profile, error: pErr } = await this.supabase.supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', dto.manager_id)
      .maybeSingle();
    if (pErr) {
      throwFromPostgrest(pErr, 'PROFILE_LOOKUP_FAILED');
    }
    if (!profile || (profile as { role: string }).role !== 'manager') {
      throw new ForbiddenException({
        message: 'manager_id must be a manager profile',
        error: 'INVALID_MANAGER',
      });
    }
    const { data, error } = await this.supabase.supabaseAdmin
      .from('manager_projects')
      .insert({
        manager_id: dto.manager_id,
        project_id: dto.project_id,
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'MANAGER_PROJECT_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Deletes a manager–project assignment by primary key.
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const admin = this.supabase.supabaseAdmin;
    const { data: existing, error: selErr } = await admin
      .from('manager_projects')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (selErr) {
      throwFromPostgrest(selErr, 'MANAGER_PROJECT_DELETE_FAILED');
    }
    if (!existing) {
      throw new NotFoundException({
        message: 'Assignment not found',
        error: 'NOT_FOUND',
      });
    }
    const { error } = await admin.from('manager_projects').delete().eq('id', id);
    if (error) {
      throwFromPostgrest(error, 'MANAGER_PROJECT_DELETE_FAILED');
    }
    return { success: true };
  }
}
