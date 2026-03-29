import { createClient, SupabaseClient } from '@supabase/supabase-js';

function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for seed helpers');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function seedTestUserRole(
  userId: string,
  role: 'super_admin' | 'manager' | 'user',
): Promise<void> {
  const { error } = await admin().from('profiles').update({ role }).eq('id', userId);
  if (error) {
    throw new Error(`seedTestUserRole: ${error.message}`);
  }
}

export async function cleanupTestBookings(bookingIds: string[]): Promise<void> {
  if (!bookingIds.length) {
    return;
  }
  await admin().from('bookings').delete().in('id', bookingIds);
}

export async function cleanupTestProjects(projectIds: string[]): Promise<void> {
  if (!projectIds.length) {
    return;
  }
  await admin().from('projects').delete().in('id', projectIds);
}

export async function cleanupTestUnits(unitIds: string[]): Promise<void> {
  if (!unitIds.length) {
    return;
  }
  await admin().from('units').delete().in('id', unitIds);
}

export function getServiceSupabase(): SupabaseClient {
  return admin();
}
