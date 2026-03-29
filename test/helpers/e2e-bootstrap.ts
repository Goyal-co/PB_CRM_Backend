import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Role = 'super_admin' | 'manager' | 'user';

const DEFAULTS: Record<string, string> = {
  TEST_SUPER_ADMIN_EMAIL: 'admin@gmail.com',
  TEST_SUPER_ADMIN_PASSWORD: 'admin1234',
  TEST_MANAGER_EMAIL: 'manager1@gmail.com',
  TEST_MANAGER_PASSWORD: 'manager1234',
  TEST_MANAGER_2_EMAIL: 'manager2@gmail.com',
  TEST_MANAGER_2_PASSWORD: 'manager2234',
  TEST_USER_EMAIL: 'user1@gmail.com',
  TEST_USER_PASSWORD: 'user1234',
  TEST_USER_2_EMAIL: 'user2@gmail.com',
  TEST_USER_2_PASSWORD: 'user2234',
  TEST_USER_3_EMAIL: 'user3@gmail.com',
  TEST_USER_3_PASSWORD: 'user3234',
  TEST_USER_4_EMAIL: 'user4@gmail.com',
  TEST_USER_4_PASSWORD: 'user4234',
};

/**
 * Ensures process.env has TEST_* credentials (defaults match bootstrap-created users).
 */
export function applyE2EEnvDefaults(): void {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
  if (!process.env.TEST_BASE_URL?.trim()) {
    process.env.TEST_BASE_URL = 'http://127.0.0.1:3000';
  }
}

async function findUserIdByEmail(
  sb: SupabaseClient,
  email: string,
): Promise<string | null> {
  const needle = email.toLowerCase();
  let page = 1;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(`listUsers: ${error.message}`);
    }
    const u = data.users.find((x) => x.email?.toLowerCase() === needle);
    if (u) {
      return u.id;
    }
    const next = data.nextPage;
    if (next == null || next === page) {
      break;
    }
    page = next;
  }
  return null;
}

async function ensureAuthUser(
  sb: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && data.user) {
    return data.user.id;
  }

  const msg = (error?.message ?? '').toLowerCase();
  const already =
    msg.includes('already') ||
    msg.includes('registered') ||
    msg.includes('exists') ||
    error?.status === 422;
  if (!already) {
    throw new Error(`createUser ${email}: ${error?.message ?? 'unknown'}`);
  }

  const id = await findUserIdByEmail(sb, email);
  if (!id) {
    throw new Error(`User ${email} exists but could not be listed`);
  }
  const { error: upErr } = await sb.auth.admin.updateUserById(id, { password });
  if (upErr) {
    throw new Error(`updateUser ${email}: ${upErr.message}`);
  }
  return id;
}

async function ensureProfileRole(
  sb: SupabaseClient,
  userId: string,
  role: Role,
): Promise<void> {
  const { error: insErr } = await sb.from('profiles').insert({
    id: userId,
    role,
    is_active: true,
  });
  if (insErr && insErr.code !== '23505') {
    throw new Error(`profiles insert: ${insErr.message}`);
  }
  const { error: updErr } = await sb
    .from('profiles')
    .update({
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (updErr) {
    throw new Error(`profiles update role: ${updErr.message}`);
  }
}

/**
 * Creates or updates E2E Auth users and profiles (service role): 1 super_admin, 2 managers, 4 users.
 * Disable with TEST_E2E_BOOTSTRAP=0 if you manage users manually.
 */
export async function ensureE2EUsers(): Promise<void> {
  if (process.env.TEST_E2E_BOOTSTRAP === '0') {
    applyE2EEnvDefaults();
    return;
  }

  applyE2EEnvDefaults();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env for E2E bootstrap',
    );
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const accounts: { email: string; password: string; role: Role }[] = [
    {
      email: process.env.TEST_SUPER_ADMIN_EMAIL!,
      password: process.env.TEST_SUPER_ADMIN_PASSWORD!,
      role: 'super_admin',
    },
    {
      email: process.env.TEST_MANAGER_EMAIL!,
      password: process.env.TEST_MANAGER_PASSWORD!,
      role: 'manager',
    },
    {
      email: process.env.TEST_MANAGER_2_EMAIL!,
      password: process.env.TEST_MANAGER_2_PASSWORD!,
      role: 'manager',
    },
    {
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
      role: 'user',
    },
    {
      email: process.env.TEST_USER_2_EMAIL!,
      password: process.env.TEST_USER_2_PASSWORD!,
      role: 'user',
    },
    {
      email: process.env.TEST_USER_3_EMAIL!,
      password: process.env.TEST_USER_3_PASSWORD!,
      role: 'user',
    },
    {
      email: process.env.TEST_USER_4_EMAIL!,
      password: process.env.TEST_USER_4_PASSWORD!,
      role: 'user',
    },
  ];

  for (const acc of accounts) {
    const userId = await ensureAuthUser(sb, acc.email, acc.password);
    await ensureProfileRole(sb, userId, acc.role);
  }
}
