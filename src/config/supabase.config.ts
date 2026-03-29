import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => {
  const url = process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  /** Dashboard: Project Settings → API → JWT Settings → "Legacy JWT secret (still used)". */
  const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? '';
  const storageUrl =
    process.env.SUPABASE_STORAGE_URL ??
    (url ? `${url.replace(/\/$/, '')}/storage/v1` : '');

  return {
    url,
    anonKey,
    serviceRoleKey,
    jwtSecret,
    storageUrl,
  };
});
