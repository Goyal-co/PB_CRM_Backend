import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { throwFromPostgrest } from './supabase-errors';

/**
 * Ensures a manager is assigned to the project or is the booking's assigned_manager.
 */
export async function assertManagerCanAccessProject(
  supabase: SupabaseService,
  user: CurrentUser,
  projectId: string,
): Promise<void> {
  if (user.role === 'super_admin') {
    return;
  }
  if (user.role !== 'manager') {
    throw new ForbiddenException({
      message: 'Manager access required',
      error: 'FORBIDDEN',
    });
  }
  const { data, error } = await supabase.supabaseAdmin
    .from('manager_projects')
    .select('id')
    .eq('manager_id', user.id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) {
    throwFromPostgrest(error, 'MANAGER_PROJECT_CHECK_FAILED');
  }
  if (!data) {
    throw new ForbiddenException({
      message: 'No access to this project',
      error: 'FORBIDDEN',
    });
  }
}

/**
 * Loads a booking and enforces role-based visibility.
 */
export async function getBookingForUser(
  supabase: SupabaseService,
  user: CurrentUser,
  bookingId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    throwFromPostgrest(error, 'BOOKING_LOAD_FAILED');
  }
  if (!data) {
    throw new NotFoundException({
      message: 'Booking not found',
      error: 'BOOKING_NOT_FOUND',
    });
  }
  const booking = data as Record<string, unknown>;
  const projectId = booking.project_id as string;
  const userId = booking.user_id as string;
  const assignedManagerId = booking.assigned_manager_id as string | null;

  if (user.role === 'super_admin') {
    return booking;
  }
  if (user.role === 'user') {
    if (userId !== user.id) {
      throw new ForbiddenException({
        message: 'Cannot access this booking',
        error: 'FORBIDDEN',
      });
    }
    return booking;
  }
  if (user.role === 'manager') {
    if (assignedManagerId === user.id) {
      return booking;
    }
    await assertManagerCanAccessProject(supabase, user, projectId);
    return booking;
  }
  throw new ForbiddenException({ message: 'Forbidden', error: 'FORBIDDEN' });
}

export async function managerManagesUser(
  supabase: SupabaseService,
  managerId: string,
  profileUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase.supabaseAdmin
    .from('profiles')
    .select('assigned_manager_id')
    .eq('id', profileUserId)
    .maybeSingle();
  if (error) {
    throwFromPostgrest(error, 'PROFILE_LOAD_FAILED');
  }
  if (!data) {
    return false;
  }
  return (data as { assigned_manager_id: string | null }).assigned_manager_id === managerId;
}
