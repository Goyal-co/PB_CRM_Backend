import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly supabaseAdmin: SupabaseClient;
  private readonly url: string;
  private readonly anonKey: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('supabase.url');
    const anonKey = this.config.getOrThrow<string>('supabase.anonKey');
    const serviceRoleKey = this.config.getOrThrow<string>(
      'supabase.serviceRoleKey',
    );
    this.url = url;
    this.anonKey = anonKey;
    this.supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Anon-key client for password login and refresh (not service role). */
  getAnonClient(): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Returns a Supabase client scoped to the caller's JWT so Postgres RLS policies apply.
   * Uses the `accessToken` option so REST/RPC requests send `Authorization: Bearer <jwt>`;
   * `setSession` without a refresh token often leaves `auth.uid()` unset in RPCs.
   */
  async getUserClient(accessToken: string): Promise<SupabaseClient> {
    return createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      accessToken: async () => accessToken,
    });
  }
}
