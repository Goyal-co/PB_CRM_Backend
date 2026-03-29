import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { throwFromPostgrest } from '@common/utils/supabase-errors';

@Injectable()
export class NotificationsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Paginates notifications for the authenticated user only.
   */
  async listForUser(
    userId: string,
    page: number,
    limit: number,
    isRead?: boolean,
  ): Promise<{ data: unknown[]; meta: Record<string, unknown> }> {
    const admin = this.supabase.supabaseAdmin;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let qb = admin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (isRead !== undefined) {
      qb = qb.eq('is_read', isRead);
    }
    const { data, error, count } = await qb.range(from, to);
    if (error) {
      throwFromPostgrest(error, 'NOTIFICATIONS_LIST_FAILED');
    }
    const { count: unread } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        unread_count: unread ?? 0,
      },
    };
  }

  async markRead(
    userId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    const admin = this.supabase.supabaseAdmin;
    const { data: row, error: gErr } = await admin
      .from('notifications')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (gErr) {
      throwFromPostgrest(gErr, 'NOTIFICATION_LOAD_FAILED');
    }
    if (!row) {
      throw new NotFoundException({
        message: 'Notification not found',
        error: 'NOTIFICATION_NOT_FOUND',
      });
    }
    const { error } = await admin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      throwFromPostgrest(error, 'NOTIFICATION_UPDATE_FAILED');
    }
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const admin = this.supabase.supabaseAdmin;
    const { data, error } = await admin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');
    if (error) {
      throwFromPostgrest(error, 'NOTIFICATION_BULK_UPDATE_FAILED');
    }
    return { count: data?.length ?? 0 };
  }

  /**
   * Creates a manual notification row for operational messaging.
   */
  async createNotification(payload: {
    user_id: string;
    booking_id?: string;
    type: string;
    title: string;
    body: string;
    action_url?: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    const { data, error } = await this.supabase.supabaseAdmin
      .from('notifications')
      .insert({
        user_id: payload.user_id,
        booking_id: payload.booking_id ?? null,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        action_url: payload.action_url ?? null,
        metadata: payload.metadata ?? {},
        is_read: false,
      })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'NOTIFICATION_CREATE_FAILED');
    }
    return data;
  }

  /**
   * Internal helper used cross-module with service role (no HTTP user context).
   */
  async notifyUser(payload: {
    user_id: string;
    booking_id?: string;
    type: string;
    title: string;
    body: string;
    action_url?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.createNotification(payload);
  }

}
