import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { mapRpcError } from '@common/utils/supabase-errors';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AssignManagerDto } from '@modules/profiles/dto/assign-manager.dto';

@Injectable()
export class AdminService {
  private readonly log = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private async userRpc<T>(
    accessToken: string,
    fn: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const client = await this.supabase.getUserClient(accessToken);
    const { data, error } = await client.rpc(fn, params);
    if (error) {
      mapRpcError(error, `${fn} failed`);
    }
    return data as T;
  }

  async createInvitation(
    accessToken: string,
    dto: CreateInvitationDto,
  ): Promise<unknown> {
    const result = await this.userRpc<Record<string, unknown>>(
      accessToken,
      'admin_create_user',
      {
        p_email: dto.email.trim().toLowerCase(),
        p_role: dto.role,
        p_first_name: dto.first_name,
        p_last_name: dto.last_name,
        p_phone: dto.phone ?? null,
        p_project_ids: dto.project_ids ?? null,
        p_manager_id: dto.manager_id ?? null,
        p_notes: dto.notes ?? null,
      },
    );

    const sendInvite =
      this.config.get<boolean>('app.adminSendInviteEmail', { infer: true }) ===
      true;
    if (sendInvite) {
      const appUrl =
        this.config.get<string>('app.appUrl', { infer: true }) ?? '';
      const redirectTo = `${appUrl.replace(/\/$/, '')}/auth/callback`;
      const { error: invErr } =
        await this.supabase.supabaseAdmin.auth.admin.inviteUserByEmail(
          dto.email.trim().toLowerCase(),
          { redirectTo },
        );
      if (invErr) {
        this.log.warn(
          `inviteUserByEmail failed after invitation record: ${invErr.message}`,
        );
      }
    }

    return result;
  }

  async assignProject(
    accessToken: string,
    userId: string,
    projectId: string,
  ): Promise<unknown> {
    return this.userRpc(accessToken, 'admin_assign_project', {
      p_user_id: userId,
      p_project_id: projectId,
    });
  }

  async removeProject(
    accessToken: string,
    userId: string,
    projectId: string,
  ): Promise<unknown> {
    return this.userRpc(accessToken, 'admin_remove_project', {
      p_user_id: userId,
      p_project_id: projectId,
    });
  }

  async assignManagerToUser(
    accessToken: string,
    userId: string,
    dto: AssignManagerDto,
  ): Promise<unknown> {
    return this.userRpc(accessToken, 'admin_assign_manager_to_user', {
      p_user_id: userId,
      p_manager_id: dto.manager_id,
    });
  }

  async getUserDirectory(
    accessToken: string,
    q: {
      role?: 'super_admin' | 'manager' | 'user';
      project_id?: string;
      is_active?: boolean;
      search?: string;
      page: number;
      limit: number;
    },
  ): Promise<unknown> {
    const offset = (q.page - 1) * q.limit;
    return this.userRpc(accessToken, 'get_admin_user_list', {
      p_role: q.role ?? null,
      p_project_id: q.project_id ?? null,
      p_is_active: q.is_active ?? null,
      p_search: q.search ?? null,
      p_limit: q.limit,
      p_offset: offset,
    });
  }

  async getProjectUserSummary(
    accessToken: string,
    projectId: string,
  ): Promise<unknown> {
    return this.userRpc(accessToken, 'get_project_user_summary', {
      p_project_id: projectId,
    });
  }

  async revokeUser(
    accessToken: string,
    userId: string,
    reason?: string,
  ): Promise<unknown> {
    return this.userRpc(accessToken, 'revoke_user_access', {
      p_user_id: userId,
      p_reason: reason ?? null,
    });
  }

  async reactivateUser(accessToken: string, userId: string): Promise<unknown> {
    return this.userRpc(accessToken, 'reactivate_user', {
      p_user_id: userId,
    });
  }
}
