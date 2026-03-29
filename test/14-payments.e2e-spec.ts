import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('14 Payments (e2e)', () => {
  beforeAll(async () => {
    await new Promise((r) => setTimeout(r, 2000));
  });

  describe('GET /payments/booking/:bookingId', () => {
    it('returns summary for super_admin', async () => {
      const res = await api(state.adminToken).get(
        `/payments/booking/${state.approvedBookingId}`,
      );
      assertSuccess(res);
      const d = res.body.data as {
        payments?: unknown[];
        summary?: { milestones?: number };
      };
      if (Array.isArray(d.payments)) {
        expect(d.payments.length).toBeGreaterThan(0);
        state.paymentId = (d.payments[0] as { id: string }).id;
      }
    });

    it('returns for owning user', async () => {
      const res = await api(state.userToken).get(
        `/payments/booking/${state.approvedBookingId}`,
      );
      assertSuccess(res);
    });

    it('returns 403 for other user booking', async () => {
      const res = await api(state.userToken).get(
        `/payments/booking/${state.secondaryBookingId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /payments', () => {
    it('lists as super_admin', async () => {
      const res = await api(state.adminToken).get('/payments?page=1&limit=50');
      assertPaginated(res);
    });

    it('filters booking_id', async () => {
      const res = await api(state.adminToken).get(
        `/payments?page=1&limit=50&booking_id=${state.approvedBookingId}`,
      );
      assertPaginated(res);
    });

    it('filters status=pending', async () => {
      const res = await api(state.adminToken).get(
        '/payments?page=1&limit=50&status=pending',
      );
      assertPaginated(res);
    });

    it('lists for user own payments', async () => {
      const res = await api(state.userToken).get('/payments?page=1&limit=50');
      assertPaginated(res);
    });
  });

  describe('GET /payments/:id', () => {
    it('returns detail', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.adminToken).get(`/payments/${state.paymentId}`);
      assertSuccess(res);
    });

    it('returns 404 for bad id', async () => {
      const res = await api(state.adminToken).get(
        `/payments/00000000-0000-0000-0000-000000000001`,
      );
      assertError(res, 404, 'PAYMENT_NOT_FOUND');
    });
  });

  describe('PATCH demand / record / clear / bounce / interest', () => {
    it('sets demand notice 1', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/demand`,
        { due_date: '2026-03-31', notice_number: 1 },
      );
      assertSuccess(res);
      expect((res.body.data as { status: string }).status).toBe('demanded');
    });

    it('sets demand notice 2', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/demand`,
        { due_date: '2026-04-15', notice_number: 2 },
      );
      assertSuccess(res);
    });

    it('returns 403 demand as user', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.userToken).patch(
        `/payments/${state.paymentId}/demand`,
        { due_date: '2026-05-01', notice_number: 1 },
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 for invalid notice_number', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/demand`,
        { due_date: '2026-05-01', notice_number: 3 as 1 },
      );
      expect(res.status).toBe(400);
    });

    it('records payment', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/record`,
        {
          amount_paid: 546000,
          payment_method: 'upi',
          upi_txn_no: 'TEST123456789',
          bank_name: 'HDFC Bank',
          paid_at: new Date().toISOString(),
        },
      );
      assertSuccess(res);
      const receipt = (res.body.data as { receipt_no?: string }).receipt_no;
      expect(receipt).toMatch(/^RCP-\d{4}-\d{10,15}$/);
    });

    it('returns 403 record as user', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.userToken).patch(
        `/payments/${state.paymentId}/record`,
        { amount_paid: 1, payment_method: 'upi' },
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 record without amount', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/record`,
        { payment_method: 'upi' } as Record<string, string>,
      );
      expect(res.status).toBe(400);
    });

    it('clears payment', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/clear`,
      );
      assertSuccess(res);
    });

    it('applies bounce fee on new received payment', async () => {
      const sum = await api(state.adminToken).get(
        `/payments/booking/${state.approvedBookingId}`,
      );
      const payments = (sum.body.data as { payments?: { id: string; status: string }[] })
        ?.payments;
      const pending = payments?.find((p) => p.status === 'pending');
      if (!pending) {
        return;
      }
      await api(state.managerToken).patch(`/payments/${pending.id}/record`, {
        amount_paid: 10000,
        payment_method: 'cheque',
        paid_at: new Date().toISOString(),
      });
      const bounce = await api(state.managerToken).patch(`/payments/${pending.id}/bounce`);
      assertSuccess(bounce);
      expect((bounce.body.data as { bounce_fee: number }).bounce_fee).toBe(5000);
    });

    it('sets interest', async () => {
      if (!state.paymentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/payments/${state.paymentId}/interest`,
        {
          interest_rate: 0.1075,
          interest_amount: 58695,
          interest_from_date: '2026-01-01',
        },
      );
      assertSuccess(res);
      expect((res.body.data as { interest_amount: number }).interest_amount).toBe(58695);
    });
  });

  describe('GET /payments/collections', () => {
    it('returns monthly collections for super_admin', async () => {
      const res = await api(state.adminToken).get('/payments/collections');
      assertSuccess(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters by year', async () => {
      const res = await api(state.adminToken).get('/payments/collections?year=2026');
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/payments/collections');
      assertError(res, 403, 'FORBIDDEN');
    });
  });
});
