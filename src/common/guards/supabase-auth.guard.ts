import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { ProfileRow } from '@common/types/supabase.types';
import { throwFromPostgrest } from '@common/utils/supabase-errors';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        message: 'Missing or invalid Authorization header',
        error: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException({
        message: 'Missing bearer token',
        error: 'UNAUTHORIZED',
      });
    }

    const {
      data: { user },
      error: authError,
    } = await this.supabase.supabaseAdmin.auth.getUser(token);

    if (authError || !user?.email) {
      throw new UnauthorizedException({
        message: authError?.message ?? 'Invalid token',
        error: 'UNAUTHORIZED',
      });
    }

    const { data: profile, error: profileError } = await this.supabase
      .supabaseAdmin.from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      throwFromPostgrest(profileError, 'PROFILE_LOAD_FAILED');
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

    const current: CurrentUser = {
      id: user.id,
      email: user.email,
      role: row.role,
      profile: row,
    };

    request.user = current;
    request.accessToken = token;
    return true;
  }
}
