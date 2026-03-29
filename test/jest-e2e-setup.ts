import { beforeAll } from '@jest/globals';
import { ensureAuthState } from './helpers/ensure-auth-state';

beforeAll(async () => {
  await ensureAuthState();
}, 120000);
