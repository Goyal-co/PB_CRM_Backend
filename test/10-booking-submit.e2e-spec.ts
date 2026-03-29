import { api } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

async function submitUntilOk(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const res = await api(state.userToken).post(`/bookings/${state.bookingId}/submit`);
    const raw = res.body.data ?? res.body;
    const success = (raw as { success?: boolean }).success;
    const missing = (raw as { missing_fields?: string[] }).missing_fields;
    if (success) {
      return;
    }
    if (missing?.length) {
      const sb = await import('./helpers/seed.helper').then((m) => m.getServiceSupabase());
      const { data: fields } = await sb
        .from('form_fields')
        .select('id, field_key')
        .in('field_key', missing);
      const values =
        (fields as { id: string }[] | null)?.map((f) => ({
          field_id: f.id,
          value_text: 'filled',
        })) ?? [];
      if (values.length) {
        await api(state.userToken).put(`/field-values/${state.bookingId}/bulk`, {
          values,
        });
      }
    } else {
      break;
    }
  }
}

describe('10 Booking submit (e2e)', () => {
  it('submits booking after required fields are satisfied', async () => {
    await submitUntilOk();
    const get = await api(state.userToken).get(`/bookings/${state.bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('submitted');
  });

  it('returns 422 when submitting an already-submitted booking', async () => {
    const res = await api(state.userToken).post(`/bookings/${state.bookingId}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when manager tries to submit user booking', async () => {
    const res = await api(state.managerToken).post(`/bookings/${state.bookingId}/submit`);
    assertError(res, 403, 'FORBIDDEN');
  });

  it('blocks PATCH booking after submit for user', async () => {
    const res = await api(state.userToken).patch(`/bookings/${state.bookingId}`, {
      notes: 'nope',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_NOT_EDITABLE');
  });

  it('blocks field value upsert for user after submit', async () => {
    const res = await api(state.userToken).put(
      `/field-values/${state.bookingId}/${state.fieldId}`,
      { value_text: 'locked' },
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FIELD_VALUES_LOCKED');
  });

  it('shows booking in pending-review for manager after submit', async () => {
    const res = await api(state.managerToken).get('/bookings/pending-review');
    assertSuccess(res);
    const ids = (res.body.data as { id: string }[]).map((b) => b.id);
    expect(ids).toContain(state.bookingId);
  });
});
