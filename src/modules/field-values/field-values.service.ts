import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { BookingStatus } from '@common/types/supabase.types';
import { getBookingForUser } from '@common/utils/access.util';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { UpsertFieldValueDto } from './dto/upsert-field-value.dto';
import { BulkFieldValuesDto } from './dto/bulk-field-values.dto';

@Injectable()
export class FieldValuesService {
  constructor(private readonly supabase: SupabaseService) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  /**
   * Rebuilds the JSON snapshot on the parent booking for quick reads.
   */
  private async refreshFieldSnapshot(bookingId: string): Promise<void> {
    const { data: rows, error } = await this.admin()
      .from('booking_field_values')
      .select(
        'field_key, value_text, value_number, value_date, value_boolean',
      )
      .eq('booking_id', bookingId);
    if (error) {
      throwFromPostgrest(error, 'FIELD_SNAPSHOT_QUERY_FAILED');
    }
    const snapshot: Record<string, string | null> = {};
    for (const row of rows ?? []) {
      const r = row as {
        field_key: string;
        value_text: string | null;
        value_number: number | null;
        value_date: string | null;
        value_boolean: boolean | null;
      };
      const coalesced =
        r.value_text ??
        (r.value_number != null ? String(r.value_number) : null) ??
        (r.value_date ?? null) ??
        (r.value_boolean != null ? String(r.value_boolean) : null);
      snapshot[r.field_key] = coalesced;
    }
    const { error: upErr } = await this.admin()
      .from('bookings')
      .update({
        field_snapshot: snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);
    if (upErr) {
      throwFromPostgrest(upErr, 'FIELD_SNAPSHOT_UPDATE_FAILED');
    }
  }

  private assertCanEditValues(
    user: CurrentUser,
    status: BookingStatus,
  ): void {
    if (user.role === 'user') {
      if (!['draft', 'revision_requested'].includes(status)) {
        throw new BadRequestException({
          message: 'Field values locked for this status',
          error: 'FIELD_VALUES_LOCKED',
        });
      }
      return;
    }
    if (user.role === 'manager') {
      if (
        !['draft', 'revision_requested', 'under_review'].includes(status)
      ) {
        throw new BadRequestException({
          message: 'Field values locked for this status',
          error: 'FIELD_VALUES_LOCKED',
        });
      }
      return;
    }
  }

  /**
   * Returns all booking field values keyed by `field_key` for quick lookup.
   */
  async getByBooking(
    user: CurrentUser,
    bookingId: string,
  ): Promise<Record<string, unknown>> {
    await getBookingForUser(this.supabase, user, bookingId);
    const { data: rows, error } = await this.admin()
      .from('booking_field_values')
      .select('*')
      .eq('booking_id', bookingId);
    if (error) {
      throwFromPostgrest(error, 'FIELD_VALUES_LOAD_FAILED');
    }
    const out: Record<string, unknown> = {};
    for (const row of rows ?? []) {
      const r = row as { field_key: string };
      out[r.field_key] = row;
    }
    return out;
  }

  /**
   * Upserts a single dynamic field answer with RBAC on editability flags.
   */
  async upsertOne(
    user: CurrentUser,
    bookingId: string,
    fieldId: string,
    dto: UpsertFieldValueDto,
  ): Promise<{ success: boolean; value: unknown }> {
    const setCount = [
      dto.value_text,
      dto.value_number,
      dto.value_date,
      dto.value_boolean,
      dto.value_json,
    ].filter((v) => v !== undefined && v !== null).length;
    if (setCount !== 1) {
      throw new BadRequestException({
        message: 'Exactly one value field must be provided',
        error: 'INVALID_FIELD_VALUE',
      });
    }
    const booking = (await getBookingForUser(
      this.supabase,
      user,
      bookingId,
    )) as { status: BookingStatus; user_id: string };
    this.assertCanEditValues(user, booking.status);

    const { data: field, error: fErr } = await this.admin()
      .from('form_fields')
      .select('editable_by_user, field_key')
      .eq('id', fieldId)
      .maybeSingle();
    if (fErr) {
      throwFromPostgrest(fErr, 'FIELD_META_FAILED');
    }
    if (!field) {
      throw new BadRequestException({
        message: 'Unknown field',
        error: 'FIELD_NOT_FOUND',
      });
    }
    if (
      user.role === 'user' &&
      (field as { editable_by_user: boolean }).editable_by_user === false
    ) {
      throw new ForbiddenException({
        message: 'Field not editable by user',
        error: 'FIELD_NOT_EDITABLE',
      });
    }

    const fk = (field as { field_key: string }).field_key;
    const payload = {
      booking_id: bookingId,
      field_id: fieldId,
      field_key: fk,
      value_text: dto.value_text ?? null,
      value_number: dto.value_number ?? null,
      value_date: dto.value_date ?? null,
      value_boolean: dto.value_boolean ?? null,
      value_json: dto.value_json ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.admin()
      .from('booking_field_values')
      .upsert(payload, { onConflict: 'booking_id,field_id' })
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'FIELD_VALUE_UPSERT_FAILED');
    }
    await this.refreshFieldSnapshot(bookingId);
    return { success: true, value: data };
  }

  /**
   * Bulk upsert for autosave flows (max 50 fields per call).
   */
  async bulkUpsert(
    user: CurrentUser,
    bookingId: string,
    dto: BulkFieldValuesDto,
  ): Promise<{ count: number }> {
    const booking = (await getBookingForUser(
      this.supabase,
      user,
      bookingId,
    )) as { status: BookingStatus };
    this.assertCanEditValues(user, booking.status);

    const fieldKeyById = new Map<string, string>();
    for (const v of dto.values) {
      const { data: field, error: fErr } = await this.admin()
        .from('form_fields')
        .select('editable_by_user, field_key')
        .eq('id', v.field_id)
        .maybeSingle();
      if (fErr) {
        throwFromPostgrest(fErr, 'FIELD_META_FAILED');
      }
      if (!field) {
        throw new BadRequestException({
          message: 'Unknown field',
          error: 'FIELD_NOT_FOUND',
        });
      }
      const meta = field as { editable_by_user: boolean; field_key: string };
      fieldKeyById.set(v.field_id, meta.field_key);
      if (user.role === 'user' && meta.editable_by_user === false) {
        throw new ForbiddenException({
          message: 'Field not editable by user',
          error: 'FIELD_NOT_EDITABLE',
        });
      }
    }

    for (const v of dto.values) {
      const payload = {
        booking_id: bookingId,
        field_id: v.field_id,
        field_key: fieldKeyById.get(v.field_id)!,
        value_text: v.value_text ?? null,
        value_number: v.value_number ?? null,
        value_date: v.value_date ?? null,
        value_boolean: v.value_boolean ?? null,
        value_json: v.value_json ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await this.admin()
        .from('booking_field_values')
        .upsert(payload, { onConflict: 'booking_id,field_id' });
      if (error) {
        throwFromPostgrest(error, 'FIELD_VALUE_BULK_FAILED');
      }
    }
    await this.refreshFieldSnapshot(bookingId);
    return { count: dto.values.length };
  }
}
