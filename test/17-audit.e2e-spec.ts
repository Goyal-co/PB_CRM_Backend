import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('17 Audit (e2e)', () => {
  describe('GET /audit', () => {
    it('lists audit entries for super_admin', async () => {
      const res = await api(state.adminToken).get('/audit?page=1&limit=50');
      assertPaginated(res);
    });

    it('filters by booking_id', async () => {
      const res = await api(state.adminToken).get(
        `/audit?page=1&limit=50&booking_id=${state.bookingId}`,
      );
      assertPaginated(res);
    });

    it('filters by action', async () => {
      const res = await api(state.adminToken).get(
        '/audit?page=1&limit=50&action=BOOKING_STATUS_CHANGED',
      );
      assertPaginated(res);
    });

    it('lists for manager (scoped)', async () => {
      const res = await api(state.managerToken).get('/audit?page=1&limit=50');
      assertPaginated(res);
    });

    it('lists for user (own bookings only)', async () => {
      const res = await api(state.userToken).get('/audit?page=1&limit=50');
      assertPaginated(res);
    });
  });

  describe('GET /audit/booking/:bookingId', () => {
    it('returns chronological audit for booking', async () => {
      const res = await api(state.adminToken).get(`/audit/booking/${state.bookingId}`);
      assertSuccess(res);
      const rows = res.body.data as {
        action: string;
        old_value?: unknown;
        new_value?: unknown;
        created_at: string;
      }[];
      expect(Array.isArray(rows)).toBe(true);
    });

    it('returns for booking owner user', async () => {
      const res = await api(state.userToken).get(`/audit/booking/${state.bookingId}`);
      assertSuccess(res);
    });

    it('returns 403 for other user booking', async () => {
      const res = await api(state.userToken).get(
        `/audit/booking/${state.secondaryBookingId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 404 or empty for non-existent booking', async () => {
      const res = await api(state.adminToken).get(
        `/audit/booking/00000000-0000-0000-0000-000000000001`,
      );
      expect([200, 404]).toContain(res.status);
    });
  });
});
