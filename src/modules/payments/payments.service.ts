import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CurrentUser } from '@common/types/user.types';
import { getBookingForUser } from '@common/utils/access.util';
import { throwFromPostgrest, mapRpcError } from '@common/utils/supabase-errors';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { DemandPaymentDto } from './dto/demand-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { InterestDto } from './dto/interest.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  private async managerBookingIds(managerId: string): Promise<string[]> {
    const { data: mp, error: mpErr } = await this.admin()
      .from('manager_projects')
      .select('project_id')
      .eq('manager_id', managerId);
    if (mpErr) {
      throwFromPostgrest(mpErr, 'MANAGER_PROJECTS_FAILED');
    }
    const pids =
      (mp as { project_id: string }[] | null)?.map((r) => r.project_id) ?? [];
    const ors = [`assigned_manager_id.eq.${managerId}`];
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
    return (bids as { id: string }[] | null)?.map((b) => b.id) ?? [];
  }

  private receiptNo(): string {
    const y = new Date().getFullYear();
    return `RCP-${y}-${Date.now()}`;
  }

  /**
   * Lists payments with booking scoping for non-admin roles.
   */
  async list(
    user: CurrentUser,
    q: QueryPaymentsDto,
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    const from = (q.page - 1) * q.limit;
    const to = from + q.limit - 1;
    let qb = this.admin().from('payments').select('*', { count: 'exact' });

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
      const ids = await this.managerBookingIds(user.id);
      if (!ids.length) {
        return {
          data: [],
          meta: { total: 0, page: q.page, limit: q.limit, totalPages: 1 },
        };
      }
      qb = qb.in('booking_id', ids);
    }

    if (q.status) {
      qb = qb.eq('status', q.status);
    }
    if (q.milestone) {
      qb = qb.eq('milestone', q.milestone);
    }
    if (q.project_id) {
      const { data: bids, error } = await this.admin()
        .from('bookings')
        .select('id')
        .eq('project_id', q.project_id);
      if (error) {
        throwFromPostgrest(error, 'BOOKING_PROJECT_FILTER_FAILED');
      }
      const ids = (bids as { id: string }[] | null)?.map((b) => b.id) ?? [];
      if (!ids.length) {
        return {
          data: [],
          meta: { total: 0, page: q.page, limit: q.limit, totalPages: 1 },
        };
      }
      qb = qb.in('booking_id', ids);
    }

    const { data, error, count } = await qb
      .order('due_date', { ascending: true })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'PAYMENTS_LIST_FAILED');
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

  async findOne(user: CurrentUser, id: string): Promise<unknown> {
    const { data, error } = await this.admin()
      .from('payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'PAYMENT_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Payment not found',
        error: 'PAYMENT_NOT_FOUND',
      });
    }
    await getBookingForUser(
      this.supabase,
      user,
      (data as { booking_id: string }).booking_id,
    );
    return data;
  }

  async summary(user: CurrentUser, bookingId: string): Promise<unknown> {
    await getBookingForUser(this.supabase, user, bookingId);
    const { data, error } = await this.admin().rpc('get_payment_summary', {
      p_booking_id: bookingId,
    });
    if (error) {
      mapRpcError(error, 'get_payment_summary failed');
    }
    return data;
  }

  /**
   * Records a receipt, stamps `received`, and generates a readable receipt number.
   */
  async record(
    user: CurrentUser,
    id: string,
    dto: RecordPaymentDto,
  ): Promise<unknown> {
    await this.findOne(user, id);
    const paidAt = dto.paid_at ?? new Date().toISOString();
    const { data, error } = await this.admin()
      .from('payments')
      .update({
        amount_paid: dto.amount_paid,
        payment_method: dto.payment_method,
        cheque_no: dto.cheque_no ?? null,
        upi_txn_no: dto.upi_txn_no ?? null,
        bank_name: dto.bank_name ?? null,
        drawn_on: dto.drawn_on ?? null,
        paid_at: paidAt,
        tds_deducted: dto.tds_deducted ?? null,
        tds_form_16b: dto.tds_form_16b ?? null,
        notes: dto.notes ?? null,
        status: 'received',
        receipt_no: this.receiptNo(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PAYMENT_RECORD_FAILED');
    }
    return data;
  }

  async clear(user: CurrentUser, id: string): Promise<unknown> {
    await this.findOne(user, id);
    const { data, error } = await this.admin()
      .from('payments')
      .update({
        status: 'cleared',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PAYMENT_CLEAR_FAILED');
    }
    return data;
  }

  async bounce(user: CurrentUser, id: string): Promise<unknown> {
    await this.findOne(user, id);
    const { data, error } = await this.admin()
      .from('payments')
      .update({
        status: 'bounced',
        bounce_fee: 5000,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PAYMENT_BOUNCE_FAILED');
    }
    return data;
  }

  /**
   * Marks a milestone as demanded and notifies the allottee.
   */
  async demand(
    user: CurrentUser,
    id: string,
    dto: DemandPaymentDto,
  ): Promise<unknown> {
    const existing = (await this.findOne(user, id)) as {
      booking_id: string;
    };
    const patch: Record<string, unknown> = {
      status: 'demanded',
      demanded_at: new Date().toISOString(),
      due_date: dto.due_date,
      updated_at: new Date().toISOString(),
    };
    if (dto.notice_number === 1) {
      patch.notice_1_sent_at = new Date().toISOString();
    } else {
      patch.notice_2_sent_at = new Date().toISOString();
    }
    const { data, error } = await this.admin()
      .from('payments')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PAYMENT_DEMAND_FAILED');
    }
    const { data: booking } = await this.admin()
      .from('bookings')
      .select('user_id, application_no')
      .eq('id', existing.booking_id)
      .maybeSingle();
    const b = booking as { user_id: string; application_no: string } | null;
    if (b?.user_id) {
      await this.notifications.notifyUser({
        user_id: b.user_id,
        booking_id: existing.booking_id,
        type: 'in_app',
        title: 'Payment demanded',
        body: `A payment milestone is due on ${dto.due_date} (${String(b.application_no)})`,
        action_url: `/bookings/${existing.booking_id}/payments`,
      });
    }
    return data;
  }

  async interest(
    user: CurrentUser,
    id: string,
    dto: InterestDto,
  ): Promise<unknown> {
    await this.findOne(user, id);
    const { data, error } = await this.admin()
      .from('payments')
      .update({
        interest_rate: dto.interest_rate,
        interest_amount: dto.interest_amount,
        interest_from_date: dto.interest_from_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'PAYMENT_INTEREST_FAILED');
    }
    return data;
  }

  /**
   * Aggregates cleared collections by calendar month for finance dashboards.
   */
  async collections(user: CurrentUser, q: {
    year?: number;
    project_id?: string;
    month?: number;
  }): Promise<{ data: { month: string; total: number }[] }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    let qb = this.admin()
      .from('payments')
      .select('amount_paid, paid_at, booking_id')
      .eq('status', 'cleared')
      .not('paid_at', 'is', null);

    if (q.year) {
      const start = `${q.year}-01-01`;
      const end = `${q.year + 1}-01-01`;
      qb = qb.gte('paid_at', start).lt('paid_at', end);
    }
    if (q.month && q.year) {
      const start = new Date(q.year, q.month - 1, 1).toISOString();
      const end = new Date(q.year, q.month, 1).toISOString();
      qb = qb.gte('paid_at', start).lt('paid_at', end);
    }

    const { data, error } = await qb;
    if (error) {
      throwFromPostgrest(error, 'COLLECTIONS_QUERY_FAILED');
    }
    let rows = (data ?? []) as {
      amount_paid: number | null;
      paid_at: string;
      booking_id: string;
    }[];

    if (q.project_id) {
      const { data: bids, error: bErr } = await this.admin()
        .from('bookings')
        .select('id')
        .eq('project_id', q.project_id);
      if (bErr) {
        throwFromPostgrest(bErr, 'BOOKING_FILTER_FAILED');
      }
      const allowed = new Set(
        (bids as { id: string }[]).map((b) => b.id),
      );
      rows = rows.filter((r) => allowed.has(r.booking_id));
    }

    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.paid_at.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + Number(r.amount_paid ?? 0));
    }
    const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return {
      data: sorted.map(([month, total]) => ({ month, total })),
    };
  }
}
