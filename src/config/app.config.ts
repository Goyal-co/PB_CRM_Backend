import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  /** When `1`, POST /admin/invitations also calls supabase.auth.admin.inviteUserByEmail */
  adminSendInviteEmail: process.env.ADMIN_SEND_INVITE_EMAIL === '1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  /**
   * When set, `POST /auth/bootstrap-admin` can create the first `super_admin` once.
   * Empty = endpoint disabled. Remove or rotate after first admin exists.
   */
  bootstrapAdminSecret: (process.env.BOOTSTRAP_ADMIN_SECRET ?? '').trim(),
}));
