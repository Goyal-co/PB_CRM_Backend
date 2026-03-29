import { api, loginUser } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { ensureAuthState } from './helpers/ensure-auth-state';
import { state } from './shared-state';

describe('16 Dashboard (e2e)', () => {
  beforeAll(async () => {
    await ensureAuthState();
    state.adminToken = await loginUser(
      process.env.TEST_SUPER_ADMIN_EMAIL!,
      process.env.TEST_SUPER_ADMIN_PASSWORD!,
    );
    state.managerToken = await loginUser(
      process.env.TEST_MANAGER_EMAIL!,
      process.env.TEST_MANAGER_PASSWORD!,
    );
    state.userToken = await loginUser(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!,
    );
  }, 120000);
  describe('GET /dashboard/my-summary', () => {
    it('returns own booking counts for user', async () => {
      const res = await api(state.userToken).get('/dashboard/my-summary');
      assertSuccess(res);
      const d = res.body.data as {
        by_status?: Record<string, number>;
        total?: number;
      };
      expect(typeof d?.total).toBe('number');
      expect(d?.by_status).toBeDefined();
      for (const n of Object.values(d.by_status ?? {})) {
        expect(typeof n).toBe('number');
      }
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).get('/dashboard/my-summary');
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for super_admin', async () => {
      const res = await api(state.adminToken).get('/dashboard/my-summary');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /dashboard/kpis', () => {
    it('returns KPI object for super_admin', async () => {
      const res = await api(state.adminToken).get('/dashboard/kpis');
      assertSuccess(res);
      const d = res.body.data as Record<string, Record<string, number>>;
      expect(typeof d).toBe('object');
      for (const k of Object.keys(d)) {
        const section = d[k];
        for (const v of Object.values(section)) {
          const scalarOk =
            v === null ||
            typeof v === 'number' ||
            typeof v === 'string' ||
            typeof v === 'boolean';
          expect(scalarOk).toBe(true);
        }
      }
    });

    it('returns KPI for manager', async () => {
      const res = await api(state.managerToken).get('/dashboard/kpis');
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/dashboard/kpis');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /dashboard/booking-funnel', () => {
    it('returns status counts', async () => {
      const res = await api(state.adminToken).get('/dashboard/booking-funnel');
      assertSuccess(res);
      const funnel = res.body.data as { data?: Record<string, number> };
      const tally = funnel?.data ?? funnel;
      expect(typeof tally).toBe('object');
    });

    it('filters by project_id', async () => {
      const res = await api(state.adminToken).get(
        `/dashboard/booking-funnel?project_id=${state.projectId}`,
      );
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/dashboard/booking-funnel');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /dashboard/inventory-summary', () => {
    it('returns grouped inventory summary', async () => {
      const res = await api(state.adminToken).get('/dashboard/inventory-summary');
      assertSuccess(res);
      const inv = res.body.data as { data?: unknown[] };
      expect(Array.isArray(inv?.data ?? inv)).toBe(true);
    });

    it('returns for manager', async () => {
      const res = await api(state.managerToken).get('/dashboard/inventory-summary');
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/dashboard/inventory-summary');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /dashboard/recent-activity', () => {
    it('returns recent activity for super_admin', async () => {
      const res = await api(state.adminToken).get('/dashboard/recent-activity');
      assertSuccess(res);
    });

    it('respects limit', async () => {
      const res = await api(state.adminToken).get('/dashboard/recent-activity?limit=5');
      assertSuccess(res);
      const payload = res.body.data as { data?: unknown[] };
      const rows = payload?.data ?? (Array.isArray(payload) ? payload : []);
      expect((rows as unknown[]).length).toBeLessThanOrEqual(5);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/dashboard/recent-activity');
      assertError(res, 403, 'FORBIDDEN');
    });
  });
});
