import { ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { throwFromPostgrest, mapRpcError } from '@common/utils/supabase-errors';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  /**
   * Role-aware KPI JSON returned directly from Supabase.
   */
  async kpis(user: CurrentUser): Promise<unknown> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    const { data, error } = await this.admin().rpc('get_dashboard_kpis');
    if (error) {
      mapRpcError(error, 'get_dashboard_kpis failed');
    }
    return data;
  }

  /**
   * Simple funnel counts grouped by booking status for funnel charts.
   */
  async bookingFunnel(
    user: CurrentUser,
    projectId?: string,
  ): Promise<{ data: Record<string, number> }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    let qb = this.admin().from('bookings').select('status');
    if (projectId) {
      qb = qb.eq('project_id', projectId);
    }
    const { data, error } = await qb;
    if (error) {
      throwFromPostgrest(error, 'FUNNEL_FAILED');
    }
    const tally: Record<string, number> = {};
    for (const row of data ?? []) {
      const s = (row as { status: string }).status;
      tally[s] = (tally[s] ?? 0) + 1;
    }
    return { data: tally };
  }

  /**
   * Inventory roll-up for tower × unit type × status matrices.
   */
  async inventorySummary(
    user: CurrentUser,
    projectId?: string,
  ): Promise<{ data: unknown[] }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    let qb = this.admin().from('units').select('tower, unit_type, status, gross_apartment_value');
    if (projectId) {
      qb = qb.eq('project_id', projectId);
    }
    const { data, error } = await qb;
    if (error) {
      throwFromPostgrest(error, 'INVENTORY_SUMMARY_FAILED');
    }
    const map = new Map<
      string,
      { tower: string; unit_type: string; status: string; count: number; value: number }
    >();
    for (const row of data ?? []) {
      const r = row as {
        tower: string;
        unit_type: string;
        status: string;
        gross_apartment_value: number | null;
      };
      const key = `${r.tower}|${r.unit_type}|${r.status}`;
      const prev = map.get(key);
      const val = Number(r.gross_apartment_value ?? 0);
      if (prev) {
        prev.count += 1;
        prev.value += val;
      } else {
        map.set(key, {
          tower: r.tower,
          unit_type: r.unit_type,
          status: r.status,
          count: 1,
          value: val,
        });
      }
    }
    return { data: [...map.values()] };
  }

  /**
   * Booking counts by status for the authenticated end-user (own bookings only).
   */
  async userMySummary(
    user: CurrentUser,
  ): Promise<{ data: { by_status: Record<string, number>; total: number } }> {
    if (user.role !== 'user') {
      throw new ForbiddenException({
        message: 'End-user dashboard only',
        error: 'FORBIDDEN',
      });
    }
    const { data, error } = await this.admin()
      .from('bookings')
      .select('status')
      .eq('user_id', user.id);
    if (error) {
      throwFromPostgrest(error, 'USER_BOOKINGS_SUMMARY_FAILED');
    }
    const by_status: Record<string, number> = {};
    for (const row of data ?? []) {
      const s = (row as { status: string }).status;
      by_status[s] = (by_status[s] ?? 0) + 1;
    }
    const total = data?.length ?? 0;
    return { data: { by_status, total } };
  }

  /**
   * Recent audit rows enriched with actor names for activity feeds.
   */
  async recentActivity(
    user: CurrentUser,
    projectId?: string,
    limit = 10,
  ): Promise<{ data: unknown[] }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    let bookingIds: string[] | undefined;
    if (projectId) {
      const { data: bids, error } = await this.admin()
        .from('bookings')
        .select('id')
        .eq('project_id', projectId);
      if (error) {
        throwFromPostgrest(error, 'BOOKING_IDS_FAILED');
      }
      bookingIds =
        (bids as { id: string }[] | null)?.map((b) => b.id) ?? [];
      if (!bookingIds.length) {
        return { data: [] };
      }
    }
    let qb = this.admin()
      .from('audit_logs')
      .select('*, profiles:user_id(first_name,last_name,email)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (bookingIds) {
      qb = qb.in('booking_id', bookingIds);
    }
    const { data, error } = await qb;
    if (error) {
      const { data: fallback, error: err2 } = await this.admin()
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (err2) {
        throwFromPostgrest(err2, 'AUDIT_ACTIVITY_FAILED');
      }
      return { data: fallback ?? [] };
    }
    return { data: data ?? [] };
  }
}
