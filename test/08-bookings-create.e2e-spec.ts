import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

function bookingPayload(over: Partial<Record<string, unknown>> = {}) {
  return {
    project_id: state.projectId,
    unit_id: state.unitId,
    form_template_id: state.templateId,
    agreement_template_id: state.agreementTemplateId,
    allottee_address: '12 Test Road, Indiranagar, Bengaluru 560038',
    allottee_phone: '9876543210',
    allottee_email: 'user-test@orchidlife.in',
    fund_source: 'home_loan',
    home_loan_pct: 80,
    joint_allottees: [],
    ...over,
  };
}

describe('08 Bookings create & list (e2e)', () => {
  beforeAll(async () => {
    const u = await api(state.adminToken).post('/units', {
      project_id: state.projectId,
      unit_no: `BK2-${randomUUID().slice(0, 8)}`,
      tower: 'A',
      floor_no: 10,
      unit_type: '3bhk',
      carpet_area_sqft: 1250,
      super_built_up_sqft: 1560,
      no_of_parking: 1,
      basic_rate_per_sqft: 7000,
      basic_sale_value: 10920000,
      maintenance_24mo: 224640,
      corpus_fund: 75000,
    });
    expect(u.status).toBe(201);
    state.unit2Id = (u.body.data as { id: string }).id;
  });

  describe('POST /bookings', () => {
    it('creates booking as user (201)', async () => {
      const res = await api(state.userToken).post('/bookings', bookingPayload());
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      const d = res.body.data as {
        id: string;
        status: string;
        application_no: string;
      };
      state.bookingId = d.id;
      state.applicationNo = d.application_no;
      expect(d.status).toBe('draft');
      expect(d.application_no).toMatch(/^OL-\d{4}-\d{4,6}$/);

      const unit = await api(state.adminToken).get(`/units/${state.unitId}`);
      assertSuccess(unit);
      expect(['blocked', 'booked', 'available']).toContain(
        (unit.body.data as { status: string }).status,
      );
    });

    it('returns 409 when booking same unit again', async () => {
      const res = await api(state.userToken).post('/bookings', bookingPayload());
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UNIT_NOT_AVAILABLE');
    });

    it('returns 404 for non-existent unit_id', async () => {
      const res = await api(state.userToken).post(
        '/bookings',
        bookingPayload({ unit_id: randomUUID() }),
      );
      assertError(res, 404, 'UNIT_NOT_FOUND');
    });

    it('returns 400 when unit project mismatches', async () => {
      const res = await api(state.userToken).post(
        '/bookings',
        bookingPayload({
          project_id: randomUUID(),
          unit_id: state.unit2Id,
        }),
      );
      expect([400, 404]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error.code).toBe('PROJECT_MISMATCH');
      }
    });

    it('allows manager to create booking', async () => {
      const res = await api(state.managerToken).post(
        '/bookings',
        {
          ...bookingPayload({ unit_id: state.unit2Id }),
        },
      );
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.secondaryBookingId = (res.body.data as { id: string }).id;
    });

    it('returns 400 when unit_id missing', async () => {
      const b = { ...bookingPayload() } as Record<string, unknown>;
      delete b.unit_id;
      const res = await api(state.userToken).post('/bookings', b);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /bookings', () => {
    it('lists as super_admin with pagination', async () => {
      const res = await api(state.adminToken).get('/bookings?page=1&limit=50');
      assertPaginated(res);
      const ids = (res.body.data as { id: string }[]).map((x) => x.id);
      expect(ids).toContain(state.bookingId);
    });

    it('lists for assigned manager', async () => {
      const res = await api(state.managerToken).get('/bookings?page=1&limit=100');
      assertPaginated(res);
    });

    it('lists only own booking as user', async () => {
      const res = await api(state.userToken).get('/bookings?page=1&limit=50');
      assertPaginated(res);
      const ids = (res.body.data as { id: string }[]).map((x) => x.id);
      expect(ids).toContain(state.bookingId);
      const rows = res.body.data as { id: string; user_id?: string }[];
      for (const row of rows) {
        if (row.user_id != null) {
          expect(row.user_id).toBe(state.userId);
        }
      }
    });

    it('filters status=draft', async () => {
      const res = await api(state.adminToken).get(
        '/bookings?page=1&limit=50&status=draft',
      );
      assertPaginated(res);
      for (const row of res.body.data as { status: string }[]) {
        expect(row.status).toBe('draft');
      }
    });

    it('searches by application_no', async () => {
      const res = await api(state.adminToken).get(
        `/bookings?page=1&limit=20&search=${encodeURIComponent(state.applicationNo)}`,
      );
      assertPaginated(res);
    });

    it('searches by allottee phone', async () => {
      const res = await api(state.adminToken).get(
        '/bookings?page=1&limit=20&search=9876543210',
      );
      assertPaginated(res);
    });
  });

  describe('GET /bookings/pending-review', () => {
    it('returns list for super_admin', async () => {
      const res = await api(state.adminToken).get('/bookings/pending-review');
      assertSuccess(res);
    });

    it('returns list for manager', async () => {
      const res = await api(state.managerToken).get('/bookings/pending-review');
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/bookings/pending-review');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /bookings/:id', () => {
    it('returns detail for super_admin', async () => {
      const res = await api(state.adminToken).get(`/bookings/${state.bookingId}`);
      assertSuccess(res);
    });

    it('returns detail for manager', async () => {
      const res = await api(state.managerToken).get(`/bookings/${state.bookingId}`);
      assertSuccess(res);
    });

    it('returns detail for owner user', async () => {
      const res = await api(state.userToken).get(`/bookings/${state.bookingId}`);
      assertSuccess(res);
    });

    it('returns 403 for user viewing another user booking', async () => {
      const res = await api(state.userToken).get(
        `/bookings/${state.secondaryBookingId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 404 for random id', async () => {
      const res = await api(state.adminToken).get(`/bookings/${randomUUID()}`);
      assertError(res, 404, 'BOOKING_NOT_FOUND');
    });
  });

  describe('PATCH /bookings/:id (draft)', () => {
    it('allows user to update own draft booking', async () => {
      const res = await api(state.userToken).patch(`/bookings/${state.bookingId}`, {
        allottee_phone: '9999988888',
        notes: 'Updated notes',
        agent_name: 'Test Agent',
      });
      assertSuccess(res);
      expect((res.body.data as { allottee_phone: string }).allottee_phone).toBe('9999988888');
    });

    it('allows manager to update draft booking', async () => {
      const res = await api(state.managerToken).patch(`/bookings/${state.bookingId}`, {
        notes: 'Manager note',
      });
      assertSuccess(res);
    });
  });

  describe('GET /bookings/:id/form', () => {
    it('returns form structure for user', async () => {
      const res = await api(state.userToken).get(`/bookings/${state.bookingId}/form`);
      assertSuccess(res);
      const d = res.body.data as { sections?: unknown[] };
      expect(Array.isArray(d.sections)).toBe(true);
    });

    it('returns form for manager', async () => {
      const res = await api(state.managerToken).get(`/bookings/${state.bookingId}/form`);
      assertSuccess(res);
    });
  });
});
