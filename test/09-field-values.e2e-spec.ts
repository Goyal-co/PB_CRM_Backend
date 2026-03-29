import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('09 Field values (e2e)', () => {
  it('upserts single field value as user', async () => {
    const res = await api(state.userToken).put(
      `/field-values/${state.bookingId}/${state.fieldId}`,
      { value_text: 'Ramesh Kumar' },
    );
    expect(res.status).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
  });

  it('upserts same field again', async () => {
    const res = await api(state.userToken).put(
      `/field-values/${state.bookingId}/${state.fieldId}`,
      { value_text: 'Ramesh Kumar Updated' },
    );
    expect(res.status).toBe(200);
    expect((res.body as { success: boolean }).success).toBe(true);
  });

  it('returns 403 for non-editable field when editable_by_user is false', async () => {
    const sb = await import('./helpers/seed.helper').then((m) => m.getServiceSupabase());
    await sb
      .from('form_fields')
      .update({ editable_by_user: false })
      .eq('id', state.selectFieldId);
    const res = await api(state.userToken).put(
      `/field-values/${state.bookingId}/${state.selectFieldId}`,
      { value_text: 'x' },
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FIELD_NOT_EDITABLE');
    await sb
      .from('form_fields')
      .update({ editable_by_user: true })
      .eq('id', state.selectFieldId);
  });

  it('returns 400 when no value provided', async () => {
    const res = await api(state.userToken).put(
      `/field-values/${state.bookingId}/${state.fieldId}`,
      {},
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FIELD_VALUE');
  });

  it('returns 403 or 404 for wrong booking id', async () => {
    const res = await api(state.userToken).put(
      `/field-values/${randomUUID()}/${state.fieldId}`,
      { value_text: 'x' },
    );
    expect([403, 404]).toContain(res.status);
  });

  it('returns 403 for another user booking', async () => {
    const res = await api(state.userToken).put(
      `/field-values/${state.secondaryBookingId}/${state.fieldId}`,
      { value_text: 'hack' },
    );
    assertError(res, 403, 'FORBIDDEN');
  });

  describe('PUT bulk', () => {
    it('bulk upserts values', async () => {
      const res = await api(state.userToken).put(
        `/field-values/${state.bookingId}/bulk`,
        {
          values: [
            { field_id: state.fieldId, value_text: 'Bulk 1' },
            { field_id: state.selectFieldId, value_text: 'Option A' },
          ],
        },
      );
      expect(res.status).toBe(200);
      const b = res.body as { success?: boolean; count?: number; data?: { count?: number } };
      const count = b.count ?? b.data?.count;
      expect(count).toBe(2);
    });

    it('returns 400 for more than 50 items', async () => {
      const values = Array.from({ length: 51 }, () => ({
        field_id: state.fieldId,
        value_text: 'x',
      }));
      const res = await api(state.userToken).put(
        `/field-values/${state.bookingId}/bulk`,
        { values },
      );
      expect(res.status).toBe(400);
    });

    it('allows manager bulk upsert on draft booking', async () => {
      const res = await api(state.managerToken).put(
        `/field-values/${state.bookingId}/bulk`,
        {
          values: [{ field_id: state.fieldId, value_text: 'Manager bulk' }],
        },
      );
      assertSuccess(res);
    });
  });

  describe('GET /field-values/:bookingId', () => {
    it('returns map keyed by field_key for user', async () => {
      const res = await api(state.userToken).get(`/field-values/${state.bookingId}`);
      assertSuccess(res);
      const data = res.body.data as Record<string, { value_text?: string }>;
      expect(data.test_text_field).toBeDefined();
    });

    it('returns for manager', async () => {
      const res = await api(state.managerToken).get(`/field-values/${state.bookingId}`);
      assertSuccess(res);
    });

    it('returns 403 for other user booking', async () => {
      const res = await api(state.userToken).get(
        `/field-values/${state.secondaryBookingId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });
});
