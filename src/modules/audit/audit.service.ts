import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { getBookingForUser } from '@common/utils/access.util';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { QueryAuditDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  /**
   * Paginated audit feed respecting booking-level visibility rules.
   */
  async list(
    user: CurrentUser,
    q: QueryAuditDto,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;
    let qb = this.admin().from('audit_logs').select('*', { count: 'exact' });

    if (q.booking_id) {
      await getBookingForUser(this.supabase, user, q.booking_id);
      qb = qb.eq('booking_id', q.booking_id);
    } else if (user.role === 'user') {
      const { data: mine, error } = await this.admin()
        .from('bookings')
        .select('id')
        .eq('user_id', user.id);
      if (error) {
        throwFromPostgrest(error, 'BOOKING_FILTER_FAILED');
      }
      const ids = (mine as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (!ids.length) {
        return {
          data: [],
          meta: { total: 0, page: q.page, limit: q.limit, totalPages: 1 },
        };
      }
      qb = qb.in('booking_id', ids);
    } else if (user.role === 'manager') {
      const { data: mp, error: mpErr } = await this.admin()
        .from('manager_projects')
        .select('project_id')
        .eq('manager_id', user.id);
      if (mpErr) {
        throwFromPostgrest(mpErr, 'MANAGER_PROJECTS_FAILED');
      }
      const pids =
        (mp as { project_id: string }[] | null)?.map((r) => r.project_id) ??
        [];
      const ors = [`assigned_manager_id.eq.${user.id}`];
      if (pids.length) {
        ors.push(`project_id.in.(${pids.join(',')})`);
      }
      const { data: bids, error } = await this.admin()
        .from('bookings')
        .select('id')
        .or(ors.join(','));
      if (error) {
        throwFromPostgrest(error, 'MANAGER_BOOKINGS_FAILED');
      }
      const ids =
        (bids as { id: string }[] | null)?.map((b) => b.id) ?? [];
      if (!ids.length) {
        return {
          data: [],
          meta: { total: 0, page: q.page, limit: q.limit, totalPages: 1 },
        };
      }
      qb = qb.in('booking_id', ids);
    }

    if (q.user_id) {
      qb = qb.eq('user_id', q.user_id);
    }
    if (q.action) {
      qb = qb.eq('action', q.action);
    }
    if (q.entity) {
      qb = qb.eq('entity', q.entity);
    }

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'AUDIT_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  /**
   * Chronological trail for regulators and dispute resolution.
   */
  async forBooking(
    user: CurrentUser,
    bookingId: string,
  ): Promise<{ data: unknown[] }> {
    await getBookingForUser(this.supabase, user, bookingId);
    const { data, error } = await this.admin()
      .from('audit_logs')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });
    if (error) {
      throwFromPostgrest(error, 'AUDIT_TRAIL_FAILED');
    }
    return { data: data ?? [] };
  }
}
