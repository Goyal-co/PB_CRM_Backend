import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('04 Manager projects (e2e)', () => {
  describe('POST /manager-projects', () => {
    it('creates assignment as super_admin (201)', async () => {
      const res = await api(state.adminToken).post('/manager-projects', {
        manager_id: state.managerId,
        project_id: state.projectId,
      });
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.managerProjectId = (res.body.data as { id: string }).id;
    });

    it('returns 409 DUPLICATE for duplicate assignment', async () => {
      const res = await api(state.adminToken).post('/manager-projects', {
        manager_id: state.managerId,
        project_id: state.projectId,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE');
    });

    it('returns 403 INVALID_MANAGER when manager_id is not a manager', async () => {
      const res = await api(state.adminToken).post('/manager-projects', {
        manager_id: state.userId,
        project_id: state.projectId,
      });
      assertError(res, 403, 'INVALID_MANAGER');
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post('/manager-projects', {
        manager_id: state.managerId,
        project_id: state.projectId,
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post('/manager-projects', {
        manager_id: state.managerId,
        project_id: state.projectId,
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /manager-projects', () => {
    it('returns list as super_admin', async () => {
      const res = await api(state.adminToken).get('/manager-projects');
      assertSuccess(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters by manager_id as super_admin', async () => {
      const res = await api(state.adminToken).get(
        `/manager-projects?manager_id=${state.managerId}`,
      );
      assertSuccess(res);
    });

    it('returns own assignments as manager', async () => {
      const res = await api(state.managerToken).get('/manager-projects');
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/manager-projects');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('DELETE /manager-projects/:id', () => {
    it('deletes as super_admin then recreates for later tests', async () => {
      const del = await api(state.adminToken).delete(
        `/manager-projects/${state.managerProjectId}`,
      );
      assertSuccess(del);

      const recreate = await api(state.adminToken).post('/manager-projects', {
        manager_id: state.managerId,
        project_id: state.projectId,
      });
      expect(recreate.status).toBe(201);
      state.managerProjectId = (recreate.body.data as { id: string }).id;
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).delete(
        `/manager-projects/${state.managerProjectId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 404 for non-existent id', async () => {
      const res = await api(state.adminToken).delete(
        `/manager-projects/${randomUUID()}`,
      );
      assertError(res, 404, 'NOT_FOUND');
    });
  });
});
