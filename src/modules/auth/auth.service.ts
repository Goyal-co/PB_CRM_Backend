import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { ProfileRow } from '@common/types/supabase.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

export interface AuthSessionPayload {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number | undefined;
  token_type: 'bearer';
  user: { id: string; email: string | undefined };
  profile: ProfileRow;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthSessionPayload> {
    const client = this.supabase.getAnonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        message: error?.message ?? 'Invalid email or password',
        error: 'INVALID_CREDENTIALS',
      });
    }

    const profile = await this.loadActiveProfile(data.user.id);
    return this.toPayload(data.session, data.user.email, profile);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthSessionPayload> {
    const client = this.supabase.getAnonClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: dto.refresh_token,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        message: error?.message ?? 'Invalid or expired refresh token',
        error: 'INVALID_REFRESH_TOKEN',
      });
    }

    const profile = await this.loadActiveProfile(data.user.id);
    return this.toPayload(data.session, data.user.email, profile);
  }

  /**
   * Creates the first `super_admin` when `BOOTSTRAP_ADMIN_SECRET` is set and no super_admin exists yet.
   */
  async bootstrapSuperAdmin(dto: BootstrapAdminDto): Promise<AuthSessionPayload> {
    const expected =
      this.config.get<string>('app.bootstrapAdminSecret', { infer: true }) ??
      '';
    if (!expected) {
      throw new ForbiddenException({
        message:
          'Bootstrap is disabled. Set BOOTSTRAP_ADMIN_SECRET in the server environment.',
        error: 'BOOTSTRAP_DISABLED',
      });
    }
    if (dto.bootstrap_secret !== expected) {
      throw new UnauthorizedException({
        message: 'Invalid bootstrap secret',
        error: 'INVALID_BOOTSTRAP_SECRET',
      });
    }

    const { count, error: countErr } = await this.supabase.supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    if (countErr) {
      throwFromPostgrest(countErr, 'PROFILE_COUNT_FAILED');
    }
    if ((count ?? 0) > 0) {
      throw new ConflictException({
        message:
          'A super_admin already exists. Sign in and use Admin invitations.',
        error: 'BOOTSTRAP_ALREADY_COMPLETED',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const { data: created, error: createErr } =
      await this.supabase.supabaseAdmin.auth.admin.createUser({
        email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          first_name: dto.first_name,
          last_name: dto.last_name,
        },
      });

    if (createErr || !created.user) {
      throw new BadRequestException({
        message: createErr?.message ?? 'Could not create auth user',
        error: 'AUTH_CREATE_FAILED',
      });
    }

    const userId = created.user.id;

    const { error: insErr } = await this.supabase.supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email,
        role: 'super_admin',
        first_name: dto.first_name,
        last_name: dto.last_name,
        is_active: true,
      });

    if (insErr) {
      if (insErr.code === '23505') {
        const { error: updErr } = await this.supabase.supabaseAdmin
          .from('profiles')
          .update({
            email,
            role: 'super_admin',
            first_name: dto.first_name,
            last_name: dto.last_name,
            is_active: true,
          })
          .eq('id', userId);
        if (updErr) {
          throwFromPostgrest(updErr, 'PROFILE_UPDATE_FAILED');
        }
      } else {
        await this.supabase.supabaseAdmin.auth.admin.deleteUser(userId);
        throwFromPostgrest(insErr, 'PROFILE_INSERT_FAILED');
      }
    }

    const client = this.supabase.getAnonClient();
    const { data: sessionData, error: signErr } =
      await client.auth.signInWithPassword({
        email,
        password: dto.password,
      });

    if (signErr || !sessionData.session || !sessionData.user) {
      throw new BadRequestException({
        message:
          signErr?.message ??
          'Admin created but sign-in failed; try POST /auth/login',
        error: 'AUTH_SIGNIN_AFTER_BOOTSTRAP_FAILED',
      });
    }

    const profile = await this.loadActiveProfile(userId);
    return this.toPayload(
      sessionData.session,
      sessionData.user.email,
      profile,
    );
  }

  private async loadActiveProfile(userId: string): Promise<ProfileRow> {
    const { data: profile, error } = await this.supabase.supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
    }

    if (!profile) {
      throw new UnauthorizedException({
        message: 'Profile not found',
        error: 'PROFILE_NOT_FOUND',
      });
    }

    const row = profile as ProfileRow;
    if (row.is_active === false) {
      throw new UnauthorizedException({
        message: 'Account is inactive',
        error: 'ACCOUNT_INACTIVE',
      });
    }

    return row;
  }

  private toPayload(
    session: Session,
    email: string | undefined,
    profile: ProfileRow,
  ): AuthSessionPayload {
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in ?? 3600,
      expires_at: session.expires_at,
      token_type: 'bearer',
      user: { id: profile.id, email: email ?? profile.email ?? undefined },
      profile,
    };
  }
}
