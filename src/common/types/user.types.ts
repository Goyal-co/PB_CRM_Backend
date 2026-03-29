import { ProfileRow } from './supabase.types';

export type UserRole = 'super_admin' | 'manager' | 'user';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  profile: ProfileRow;
}
