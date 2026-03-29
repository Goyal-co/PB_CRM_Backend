import { randomUUID } from 'crypto';
import { api, loginUser } from './helpers/auth.helper';
import { ensureAuthState } from './helpers/ensure-auth-state';
import { state } from './shared-state';

type Role = 'super_admin' | 'manager' | 'user';

function tokenFor(role: Role): string {
  if (role === 'super_admin') {
    return state.adminToken;
  }
  if (role === 'manager') {
    return state.managerToken;
  }
  return state.userToken;
}

describe('18 Role access matrix (e2e)', () => {
  const cases: {
    method: 'GET' | 'POST';
    path: string;
    role: Role;
    expected: number;
    body?: object;
  }[] = [];

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
    const pid = state.projectId;
    if (!pid) {
      throw new Error('Role matrix requires state.projectId from earlier e2e files');
    }
    // Matrix + manager-only routes need manager_projects; test 04 also creates this in full runs.
    const mp = await api(state.adminToken).post('/manager-projects', {
      manager_id: state.managerId,
      project_id: pid,
    });
    expect([201, 409]).toContain(mp.status);

    cases.push(
      { method: 'GET', path: '/projects', role: 'user', expected: 200 },
      { method: 'POST', path: '/projects', role: 'user', expected: 403 },
      { method: 'POST', path: '/projects', role: 'manager', expected: 403 },
      {
        method: 'POST',
        path: '/projects',
        role: 'super_admin',
        expected: 201,
        body: {
          name: 'Matrix Project',
          rera_number: `TEST/MATRIX/${randomUUID().slice(0, 8)}`,
          rera_website: 'x',
          plan_sanction_no: 'p',
          land_area_guntas: 1,
          possession_date: '2030-01-01',
          address: 'a',
        },
      },
      { method: 'GET', path: '/profiles', role: 'user', expected: 403 },
      { method: 'GET', path: '/profiles', role: 'manager', expected: 403 },
      { method: 'GET', path: '/profiles', role: 'super_admin', expected: 200 },
      { method: 'GET', path: '/profiles/managers', role: 'manager', expected: 403 },
      { method: 'GET', path: '/profiles/managers', role: 'super_admin', expected: 200 },
      {
        method: 'GET',
        path: `/units/matrix?project_id=${pid}`,
        role: 'user',
        expected: 403,
      },
      {
        method: 'GET',
        path: `/units/matrix?project_id=${pid}`,
        role: 'manager',
        expected: 200,
      },
      { method: 'POST', path: '/units', role: 'user', expected: 403 },
      { method: 'POST', path: '/units', role: 'manager', expected: 403 },
      { method: 'POST', path: '/form-templates', role: 'user', expected: 403 },
      { method: 'POST', path: '/form-templates', role: 'manager', expected: 403 },
      { method: 'GET', path: '/agreement-templates', role: 'user', expected: 403 },
      { method: 'POST', path: '/agreement-templates', role: 'user', expected: 403 },
      { method: 'POST', path: '/agreement-templates', role: 'manager', expected: 403 },
      { method: 'GET', path: '/bookings/pending-review', role: 'user', expected: 403 },
      { method: 'GET', path: '/dashboard/kpis', role: 'user', expected: 403 },
      { method: 'GET', path: '/dashboard/kpis', role: 'manager', expected: 200 },
      {
        method: 'GET',
        path: '/dashboard/my-summary',
        role: 'user',
        expected: 200,
      },
      {
        method: 'GET',
        path: '/dashboard/my-summary',
        role: 'manager',
        expected: 403,
      },
      { method: 'GET', path: '/payments/collections', role: 'user', expected: 403 },
      { method: 'GET', path: '/payments/collections', role: 'manager', expected: 200 },
      { method: 'GET', path: '/audit', role: 'user', expected: 200 },
    );
  }, 120000);

  it('enforces matrix across endpoints', async () => {
    for (const c of cases) {
      const t = tokenFor(c.role);
      const client = api(t);
      let res;
      if (c.method === 'GET') {
        res = await client.get(c.path);
      } else {
        res = await client.post(c.path, c.body ?? {});
      }
      expect(res.status).toBe(c.expected);
      if (
        c.method === 'POST' &&
        c.path === '/projects' &&
        c.expected === 201 &&
        res.status === 201
      ) {
        const id = (res.body as { data?: { id: string } }).data?.id;
        if (id) {
          await api(state.adminToken).delete(`/projects/${id}`);
        }
      }
    }
  });
});
