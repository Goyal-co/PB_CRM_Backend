import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import {
  createThrowawayAuthUser,
  deleteAuthUser,
} from './helpers/create-user.helper';
import { state } from './shared-state';

describe('03 Profiles (e2e)', () => {
  describe('GET /profiles/me', () => {
    it('returns super_admin profile', async () => {
      const res = await api(state.adminToken).get('/profiles/me');
      assertSuccess(res);
      expect((res.body.data as { role: string }).role).toBe('super_admin');
    });

    it('returns manager profile', async () => {
      const res = await api(state.managerToken).get('/profiles/me');
      assertSuccess(res);
      expect((res.body.data as { role: string }).role).toBe('manager');
    });

    it('returns user profile', async () => {
      const res = await api(state.userToken).get('/profiles/me');
      assertSuccess(res);
      expect((res.body.data as { role: string }).role).toBe('user');
    });
  });

  describe('PATCH /profiles/me', () => {
    it('updates allowed fields as user', async () => {
      const res = await api(state.userToken).patch('/profiles/me', {
        first_name: 'TestFirst',
        last_name: 'TestLast',
        phone: '9999900000',
      });
      assertSuccess(res);
      expect((res.body.data as { first_name: string }).first_name).toBe('TestFirst');
    });

    it('ignores role self-promotion in payload', async () => {
      const res = await api(state.userToken).patch('/profiles/me', {
        role: 'super_admin',
      });
      assertSuccess(res);
      expect((res.body.data as { role: string }).role).toBe('user');
    });

    it('validates or persists phone field', async () => {
      const res = await api(state.userToken).patch('/profiles/me', {
        phone: 'not-a-valid-phone-format-!!!',
      });
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('GET /profiles — list', () => {
    it('returns paginated list as super_admin', async () => {
      const res = await api(state.adminToken).get('/profiles?page=1&limit=20');
      assertPaginated(res);
    });

    it('filters by role=manager', async () => {
      const res = await api(state.adminToken).get(
        '/profiles?page=1&limit=50&role=manager',
      );
      assertPaginated(res);
      for (const row of res.body.data as { role: string }[]) {
        expect(row.role).toBe('manager');
      }
    });

    it('supports search query', async () => {
      const res = await api(state.adminToken).get(
        '/profiles?page=1&limit=20&search=Test',
      );
      assertSuccess(res);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).get('/profiles');
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/profiles');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /profiles/:id', () => {
    it('allows super_admin to load any profile', async () => {
      const res = await api(state.adminToken).get(`/profiles/${state.userId}`);
      assertSuccess(res);
    });

    it('allows manager to load self', async () => {
      const res = await api(state.managerToken).get(`/profiles/${state.managerId}`);
      assertSuccess(res);
    });

    it('allows user to load self only', async () => {
      const res = await api(state.userToken).get(`/profiles/${state.userId}`);
      assertSuccess(res);
    });

    it('returns 403 when user loads another profile', async () => {
      const res = await api(state.userToken).get(`/profiles/${state.adminId}`);
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('PATCH /profiles/:id/role', () => {
    it('changes manager to user then restores manager', async () => {
      const r1 = await api(state.adminToken).patch(`/profiles/${state.managerId}/role`, {
        role: 'user',
      });
      assertSuccess(r1);
      expect((r1.body.data as { role: string }).role).toBe('user');

      const r2 = await api(state.adminToken).patch(`/profiles/${state.managerId}/role`, {
        role: 'manager',
      });
      assertSuccess(r2);
      expect((r2.body.data as { role: string }).role).toBe('manager');
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(`/profiles/${state.userId}/role`, {
        role: 'user',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).patch(`/profiles/${state.userId}/role`, {
        role: 'manager',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 for invalid role value', async () => {
      const res = await api(state.adminToken).patch(`/profiles/${state.userId}/role`, {
        role: 'invalid' as 'user',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /profiles/:id/assign-manager', () => {
    it('assigns manager to user as super_admin', async () => {
      const res = await api(state.adminToken).patch(`/profiles/${state.userId}/assign-manager`, {
        manager_id: state.managerId,
      });
      assertSuccess(res);
    });

    it('allows manager to view assigned user profile', async () => {
      const res = await api(state.managerToken).get(`/profiles/${state.userId}`);
      assertSuccess(res);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(`/profiles/${state.userId}/assign-manager`, {
        manager_id: state.managerId,
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /profiles/managers', () => {
    it('returns only managers for super_admin', async () => {
      const res = await api(state.adminToken).get('/profiles/managers');
      assertSuccess(res);
      const rows = res.body.data as { role: string }[];
      expect(Array.isArray(rows)).toBe(true);
      for (const m of rows) {
        expect(m.role).toBe('manager');
      }
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).get('/profiles/managers');
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/profiles/managers');
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('PATCH /profiles/:id/deactivate', () => {
    it('deactivates a throwaway user as super_admin', async () => {
      const email = `deactivate-${randomUUID()}@orchidlife.in`;
      const id = await createThrowawayAuthUser(email, 'TestDeactivate@123');
      state.throwawayUserId = id;

      const res = await api(state.adminToken).patch(`/profiles/${id}/deactivate`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      await deleteAuthUser(id);
      state.throwawayUserId = '';
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(`/profiles/${state.userId}/deactivate`);
      assertError(res, 403, 'FORBIDDEN');
    });
  });
});
