import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

/** Unique per Jest process so repeated e2e runs against the same DB do not 409 on POST /units. */
const E2E_PRIMARY_UNIT_NO = `TEST-T1-${randomUUID().slice(0, 10)}`;

function unitPayload(over: Partial<Record<string, unknown>> = {}) {
  return {
    project_id: state.projectId,
    unit_no: E2E_PRIMARY_UNIT_NO,
    tower: 'A',
    floor_no: 1,
    unit_type: '3bhk',
    carpet_area_sqft: 1250,
    super_built_up_sqft: 1560,
    no_of_parking: 1,
    basic_rate_per_sqft: 7000,
    basic_sale_value: 10920000,
    maintenance_24mo: 224640,
    corpus_fund: 75000,
    ...over,
  };
}

describe('05 Units (e2e)', () => {
  describe('POST /units', () => {
    it('creates unit as super_admin (201)', async () => {
      const res = await api(state.adminToken).post('/units', unitPayload());
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.unitId = (res.body.data as { id: string }).id;
    });

    it('returns 409 DUPLICATE for duplicate tower/floor/unit_no', async () => {
      const res = await api(state.adminToken).post('/units', unitPayload());
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE');
    });

    it('returns 400 for invalid tower', async () => {
      const res = await api(state.adminToken).post(
        '/units',
        unitPayload({ tower: 'Z', unit_no: `U-${randomUUID().slice(0, 6)}` }),
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid unit_type', async () => {
      const res = await api(state.adminToken).post(
        '/units',
        unitPayload({
          unit_no: `U-${randomUUID().slice(0, 6)}`,
          unit_type: '5bhk' as '3bhk',
        }),
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post(
        '/units',
        unitPayload({ unit_no: 'X-1' }),
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post(
        '/units',
        unitPayload({ unit_no: 'X-2' }),
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /units', () => {
    it('lists as super_admin', async () => {
      const res = await api(state.adminToken).get('/units?page=1&limit=20');
      assertPaginated(res);
    });

    it('filters tower=A', async () => {
      const res = await api(state.adminToken).get(
        `/units?page=1&limit=50&tower=A&project_id=${state.projectId}`,
      );
      assertPaginated(res);
      for (const u of res.body.data as { tower: string }[]) {
        expect(u.tower).toBe('A');
      }
    });

    it('filters by project_id', async () => {
      const res = await api(state.adminToken).get(
        `/units?page=1&limit=50&project_id=${state.projectId}`,
      );
      assertPaginated(res);
    });

    it('lists as manager', async () => {
      const res = await api(state.managerToken).get('/units?page=1&limit=20');
      assertPaginated(res);
    });

    it('lists only available units for user role', async () => {
      const res = await api(state.userToken).get(
        `/units?page=1&limit=100&project_id=${state.projectId}`,
      );
      assertPaginated(res);
      for (const u of res.body.data as { status: string }[]) {
        expect(u.status).toBe('available');
      }
    });
  });

  describe('GET /units/matrix', () => {
    it('returns matrix for super_admin with project_id', async () => {
      const res = await api(state.adminToken).get(
        `/units/matrix?project_id=${state.projectId}`,
      );
      assertSuccess(res);
    });

    it('returns matrix for assigned manager', async () => {
      const res = await api(state.managerToken).get(
        `/units/matrix?project_id=${state.projectId}`,
      );
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get(
        `/units/matrix?project_id=${state.projectId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 without project_id', async () => {
      const res = await api(state.adminToken).get('/units/matrix');
      assertError(res, 400, 'BAD_REQUEST');
    });
  });

  describe('GET /units/:id', () => {
    it('returns unit as super_admin', async () => {
      const res = await api(state.adminToken).get(`/units/${state.unitId}`);
      assertSuccess(res);
      expect((res.body.data as { unit_no: string }).unit_no).toBeDefined();
    });

    it('returns available unit for user', async () => {
      const create = await api(state.adminToken).post(
        '/units',
        unitPayload({
          unit_no: `AV-${randomUUID().slice(0, 8)}`,
          floor_no: 2,
        }),
      );
      expect(create.status).toBe(201);
      const id = (create.body.data as { id: string }).id;
      const res = await api(state.userToken).get(`/units/${id}`);
      assertSuccess(res);
    });
  });

  describe('GET /units/:id — non-existent', () => {
    it('returns 404', async () => {
      const res = await api(state.adminToken).get(`/units/${randomUUID()}`);
      assertError(res, 404, 'UNIT_NOT_FOUND');
    });
  });

  describe('PATCH /units/:id', () => {
    it('updates as super_admin', async () => {
      const res = await api(state.adminToken).patch(`/units/${state.unitId}`, {
        basic_rate_per_sqft: 7200,
        remarks: 'Updated test unit',
      });
      assertSuccess(res);
      expect((res.body.data as { basic_rate_per_sqft: number }).basic_rate_per_sqft).toBe(7200);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(`/units/${state.unitId}`, {
        remarks: 'x',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).patch(`/units/${state.unitId}`, {
        remarks: 'x',
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('POST /units/bulk', () => {
    it('inserts 3 units', async () => {
      const bulkId = randomUUID().slice(0, 8);
      const base = unitPayload({
        tower: 'B',
        floor_no: 3,
        carpet_area_sqft: 1100,
        super_built_up_sqft: 1400,
        basic_sale_value: 9000000,
      });
      const units = [
        { ...base, unit_no: `TEST-BLK-${bulkId}-01` },
        { ...base, unit_no: `TEST-BLK-${bulkId}-02`, floor_no: 4 },
        { ...base, unit_no: `TEST-BLK-${bulkId}-03`, floor_no: 5 },
      ];
      const res = await api(state.adminToken).post('/units/bulk', { units });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect((res.body.data as { inserted: number }).inserted).toBe(3);
      expect((res.body.data as { skipped: number }).skipped).toBe(0);
    });

    it('skips one duplicate in bulk', async () => {
      const dupId = randomUUID().slice(0, 8);
      const base = unitPayload({
        tower: 'C',
        floor_no: 1,
        unit_no: `TEST-C-DUP-${dupId}-1`,
        carpet_area_sqft: 1100,
        super_built_up_sqft: 1400,
        basic_sale_value: 9000000,
      });
      const units = [
        base,
        { ...base, unit_no: `TEST-C-DUP-${dupId}-2` },
        { ...base, unit_no: `TEST-C-DUP-${dupId}-1` },
      ];
      const res = await api(state.adminToken).post('/units/bulk', { units });
      expect(res.status).toBe(201);
      expect((res.body.data as { inserted: number }).inserted).toBe(2);
      expect((res.body.data as { skipped: number }).skipped).toBe(1);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post('/units/bulk', {
        units: [unitPayload({ unit_no: 'NOPE', tower: 'B', floor_no: 9 })],
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 when more than 100 units', async () => {
      const u = unitPayload({ unit_no: 'BULK', tower: 'D', floor_no: 1 });
      const units = Array.from({ length: 101 }, (_, i) => ({
        ...u,
        unit_no: `B-${i}`,
      }));
      const res = await api(state.adminToken).post('/units/bulk', { units });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
