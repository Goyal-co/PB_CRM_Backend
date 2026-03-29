import {
  api,
  loginUser,
  loginViaNestApi,
  loginViaNestApiFull,
  refreshViaNestApi,
  unauthenticated,
} from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';

const EXPIRED_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0T--kZu0WFYdis3Lb3ZkYIUh8IjJN6Zv5ZrVrA';

/** Roster seeded by `ensureE2EUsers`: 1 super_admin, 2 managers, 4 users (see e2e-bootstrap.ts). */
const E2E_AUTH_ROSTER: { email: string; password: string; role: string }[] = [
  {
    email: process.env.TEST_SUPER_ADMIN_EMAIL!,
    password: process.env.TEST_SUPER_ADMIN_PASSWORD!,
    role: 'super_admin',
  },
  {
    email: process.env.TEST_MANAGER_EMAIL!,
    password: process.env.TEST_MANAGER_PASSWORD!,
    role: 'manager',
  },
  {
    email: process.env.TEST_MANAGER_2_EMAIL!,
    password: process.env.TEST_MANAGER_2_PASSWORD!,
    role: 'manager',
  },
  {
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!,
    role: 'user',
  },
  {
    email: process.env.TEST_USER_2_EMAIL!,
    password: process.env.TEST_USER_2_PASSWORD!,
    role: 'user',
  },
  {
    email: process.env.TEST_USER_3_EMAIL!,
    password: process.env.TEST_USER_3_PASSWORD!,
    role: 'user',
  },
  {
    email: process.env.TEST_USER_4_EMAIL!,
    password: process.env.TEST_USER_4_PASSWORD!,
    role: 'user',
  },
];

describe('01 Auth boundary (e2e)', () => {
  it('rejects GET /profiles/me without Authorization with 401 UNAUTHORIZED', async () => {
    const res = await unauthenticated().get('/profiles/me');
    assertError(res, 401, 'UNAUTHORIZED');
  });

  it('rejects GET /profiles/me with malformed Bearer token (401)', async () => {
    const res = await unauthenticated()
      .get('/profiles/me')
      .set('Authorization', 'Bearer invalidtoken123');
    assertError(res, 401, 'UNAUTHORIZED');
  });

  it('rejects GET /profiles/me with expired JWT (401)', async () => {
    const res = await unauthenticated()
      .get('/profiles/me')
      .set('Authorization', `Bearer ${EXPIRED_JWT}`);
    assertError(res, 401, 'UNAUTHORIZED');
  });

  it.each(E2E_AUTH_ROSTER)(
    'POST /auth/login ($role): me matches role',
    async ({ email, password, role }) => {
      const session = await loginViaNestApiFull(email, password);
      expect(session.profile.role).toBe(role);
      expect(session.access_token.length).toBeGreaterThan(20);
      const res = await api(session.access_token).get('/profiles/me');
      assertSuccess(res);
      expect((res.body.data as { role: string }).role).toBe(role);
    },
  );

  it.each(E2E_AUTH_ROSTER)(
    'Supabase direct login ($role) still works for same roster',
    async ({ email, password, role }) => {
      const token = await loginUser(email, password);
      const res = await api(token).get('/profiles/me');
      assertSuccess(res);
      expect((res.body.data as { role: string }).role).toBe(role);
    },
  );

  it('POST /auth/login rejects wrong password', async () => {
    const res = await unauthenticated().post('/auth/login', {
      email: process.env.TEST_USER_EMAIL!,
      password: 'DefinitelyWrongPassword!',
    });
    assertError(res, 401, 'INVALID_CREDENTIALS');
  });

  it('POST /auth/refresh returns new access_token', async () => {
    const first = await loginViaNestApiFull(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!,
    );
    const second = await refreshViaNestApi(first.refresh_token);
    expect(second.access_token).not.toBe(first.access_token);
    const res = await api(second.access_token).get('/profiles/me');
    assertSuccess(res);
    expect((res.body.data as { role: string }).role).toBe('user');
  });

  it('logs in super_admin via Nest and GET /profiles/me returns role super_admin', async () => {
    const token = await loginViaNestApi(
      process.env.TEST_SUPER_ADMIN_EMAIL!,
      process.env.TEST_SUPER_ADMIN_PASSWORD!,
    );
    const res = await api(token).get('/profiles/me');
    assertSuccess(res);
    expect((res.body.data as { role: string }).role).toBe('super_admin');
  });

  it('logs in manager and GET /profiles/me returns role manager', async () => {
    const token = await loginUser(
      process.env.TEST_MANAGER_EMAIL!,
      process.env.TEST_MANAGER_PASSWORD!,
    );
    const res = await api(token).get('/profiles/me');
    assertSuccess(res);
    expect((res.body.data as { role: string }).role).toBe('manager');
  });

  it('logs in user and GET /profiles/me returns role user', async () => {
    const token = await loginUser(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!,
    );
    const res = await api(token).get('/profiles/me');
    assertSuccess(res);
    expect((res.body.data as { role: string }).role).toBe('user');
  });
});
