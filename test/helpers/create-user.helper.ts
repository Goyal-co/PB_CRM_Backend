import { getServiceSupabase } from './seed.helper';

export async function createThrowawayAuthUser(
  email: string,
  password: string,
): Promise<string> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createThrowawayAuthUser: ${error?.message ?? 'no user'}`);
  }
  const id = data.user.id;
  const { error: pErr } = await sb.from('profiles').insert({
    id,
    role: 'user',
    is_active: true,
  });
  if (pErr && pErr.code !== '23505') {
    throw new Error(`createThrowawayAuthUser profile: ${pErr.message}`);
  }
  return id;
}

export async function deleteAuthUser(userId: string): Promise<void> {
  const sb = getServiceSupabase();
  await sb.from('profiles').delete().eq('id', userId);
  await sb.auth.admin.deleteUser(userId);
}
