import { api, loginUser } from './auth.helper';
import { assertSuccess } from './assertions.helper';
import { ensureE2EUsers } from './e2e-bootstrap';
import { state } from '../shared-state';

const PROCESS_SETUP_KEY = '__PB_CRM_E2E_AUTH_SETUP_PROMISE__' as const;

function getSetupPromise(): Promise<void> | undefined {
  const p = process as NodeJS.Process & {
    [PROCESS_SETUP_KEY]?: Promise<void>;
  };
  return p[PROCESS_SETUP_KEY];
}

function setSetupPromise(promise: Promise<void>): void {
  const p = process as NodeJS.Process & {
    [PROCESS_SETUP_KEY]?: Promise<void>;
  };
  p[PROCESS_SETUP_KEY] = promise;
}

/**
 * Idempotent: ensures bootstrap users exist and JWTs + profile ids are on `state`.
 * Safe to call from every spec file; only one concurrent run performs network work.
 */
export function ensureAuthState(): Promise<void> {
  if (
    state.adminToken &&
    state.managerToken &&
    state.userToken &&
    state.adminId &&
    state.managerId &&
    state.userId
  ) {
    return Promise.resolve();
  }
  let p = getSetupPromise();
  if (!p) {
    p = doSetup();
    setSetupPromise(p);
  }
  return p;
}

async function doSetup(): Promise<void> {
  await ensureE2EUsers();

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

  const adminMe = await api(state.adminToken).get('/profiles/me');
  assertSuccess(adminMe);
  state.adminId = (adminMe.body.data as { id: string }).id;

  const mgrMe = await api(state.managerToken).get('/profiles/me');
  assertSuccess(mgrMe);
  state.managerId = (mgrMe.body.data as { id: string }).id;

  const userMe = await api(state.userToken).get('/profiles/me');
  assertSuccess(userMe);
  state.userId = (userMe.body.data as { id: string }).id;
}
