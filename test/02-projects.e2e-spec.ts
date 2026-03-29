import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

function projectBody(reraSuffix: string) {
  return {
    name: 'TEST PROJECT',
    rera_number: `TEST/RERA/${reraSuffix}`,
    rera_website: 'www.rera.karnataka.gov.in',
    plan_sanction_no: 'BBMP/TEST/001',
    land_area_guntas: 7,
    total_units: 100,
    total_towers: 2,
    possession_date: '2030-06-30',
    address: '123 Test Street, Bengaluru',
    city: 'Bengaluru',
    vendor_name: 'M/s TEST ASSOCIATES',
    vendor_phone: '080-12345678',
    vendor_email: 'test@orchidlife.in',
    vendor_rep_name: 'Test Rep',
  };
}

describe('02 Projects (e2e)', () => {
  describe('GET /projects — list', () => {
    it('returns paginated list as super_admin', async () => {
      const res = await api(state.adminToken).get('/projects?page=1&limit=10');
      assertPaginated(res);
    });

    it('returns paginated list as manager', async () => {
      const res = await api(state.managerToken).get('/projects?page=1&limit=10');
      assertPaginated(res);
    });

    it('returns paginated list as user', async () => {
      const res = await api(state.userToken).get('/projects?page=1&limit=10');
      assertPaginated(res);
    });

    it('returns 401 without token', async () => {
      const { unauthenticated } = await import('./helpers/auth.helper');
      const res = await unauthenticated().get('/projects');
      assertError(res, 401, 'UNAUTHORIZED');
    });
  });

  describe('POST /projects — create', () => {
    it('creates project as super_admin (201) and stores id', async () => {
      const suffix = randomUUID().slice(0, 8);
      const body = projectBody(suffix);
      const res = await api(state.adminToken).post('/projects', body);
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      const d = res.body.data as { id: string; rera_number: string };
      expect(d.id).toBeDefined();
      expect(d.rera_number).toBe(body.rera_number);
      state.projectId = d.id;
      const upa = await api(state.adminToken).post(
        `/admin/users/${state.userId}/project-assignments`,
        { project_id: state.projectId },
      );
      expect(upa.status).toBe(200);
      assertSuccess(upa);
    });

    it('returns 409 DUPLICATE when posting the same payload twice', async () => {
      const suffix = `DUP-${randomUUID().slice(0, 8)}`;
      const body = projectBody(suffix);
      const first = await api(state.adminToken).post('/projects', body);
      expect(first.status).toBe(201);
      const dupId = (first.body.data as { id: string }).id;
      const second = await api(state.adminToken).post('/projects', body);
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
      expect(second.body.error.code).toBe('DUPLICATE');
      await api(state.adminToken).delete(`/projects/${dupId}`);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post(
        '/projects',
        projectBody(randomUUID()),
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post(
        '/projects',
        projectBody(randomUUID()),
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 when rera_number is missing', async () => {
      const b = projectBody('missing-rera') as Record<string, unknown>;
      delete b.rera_number;
      const res = await api(state.adminToken).post('/projects', b);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid possession_date', async () => {
      const res = await api(state.adminToken).post('/projects', {
        ...projectBody('bad-date'),
        possession_date: 'not-a-date',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /projects/:id', () => {
    it('returns project for any authenticated role', async () => {
      const res = await api(state.userToken).get(`/projects/${state.projectId}`);
      assertSuccess(res);
      expect((res.body.data as { id: string }).id).toBe(state.projectId);
    });

    it('returns 404 for non-existent id', async () => {
      const res = await api(state.adminToken).get(
        `/projects/${randomUUID()}`,
      );
      assertError(res, 404, 'PROJECT_NOT_FOUND');
    });
  });

  describe('PATCH /projects/:id', () => {
    it('updates as super_admin', async () => {
      const res = await api(state.adminToken).patch(`/projects/${state.projectId}`, {
        name: 'UPDATED TEST PROJECT',
        total_units: 150,
      });
      assertSuccess(res);
      expect((res.body.data as { name: string }).name).toBe('UPDATED TEST PROJECT');
      expect((res.body.data as { total_units: number }).total_units).toBe(150);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(`/projects/${state.projectId}`, {
        name: 'x',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).patch(`/projects/${state.projectId}`, {
        name: 'x',
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /projects/:id/stats', () => {
    it('returns stats as super_admin', async () => {
      const res = await api(state.adminToken).get(`/projects/${state.projectId}/stats`);
      assertSuccess(res);
      const d = res.body.data as Record<string, unknown>;
      expect(d).toHaveProperty('total_units');
      expect(d).toHaveProperty('available');
      expect(d).toHaveProperty('booked');
      expect(d).toHaveProperty('total_bookings');
    });

    it('returns 403 for manager not assigned to project', async () => {
      const create = await api(state.adminToken).post(
        '/projects',
        projectBody(`iso-${randomUUID().slice(0, 8)}`),
      );
      expect(create.status).toBe(201);
      const pid = (create.body.data as { id: string }).id;
      const res = await api(state.managerToken).get(`/projects/${pid}/stats`);
      assertError(res, 403, 'FORBIDDEN');
      await api(state.adminToken).delete(`/projects/${pid}`);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get(`/projects/${state.projectId}/stats`);
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('DELETE /projects/:id', () => {
    it('returns 403 for manager', async () => {
      const create = await api(state.adminToken).post(
        '/projects',
        projectBody(`del-mgr-${randomUUID().slice(0, 8)}`),
      );
      expect(create.status).toBe(201);
      const pid = (create.body.data as { id: string }).id;
      const res = await api(state.managerToken).delete(`/projects/${pid}`);
      assertError(res, 403, 'FORBIDDEN');
      await api(state.adminToken).delete(`/projects/${pid}`);
    });

    it('soft-deletes disposable project as super_admin', async () => {
      const create = await api(state.adminToken).post(
        '/projects',
        projectBody(`del-adm-${randomUUID().slice(0, 8)}`),
      );
      expect(create.status).toBe(201);
      const pid = (create.body.data as { id: string }).id;
      const res = await api(state.adminToken).delete(`/projects/${pid}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
