import { createClient } from '@supabase/supabase-js';

// ts-jest + supertest CJS interop: default import is not always callable
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

/** Default to loopback IPv4 so Windows does not resolve `localhost` to ::1 and hit a different listener than Nest (0.0.0.0). */
export const BASE_URL =
  process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

const API = '/api/v1';

/**
 * Login via Supabase Auth (requires anon key — not service role).
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY must be set (e.g. project root .env)',
    );
  }
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return data.session.access_token;
}

export function api(token: string) {
  return {
    get: (path: string) =>
      request(BASE_URL)
        .get(`${API}${path}`)
        .set('Authorization', `Bearer ${token}`),
    /** Binary responses (e.g. PDF) without corrupting the body. */
    getBuffer: (path: string) =>
      request(BASE_URL)
        .get(`${API}${path}`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            chunks.push(Buffer.from(chunk));
          });
          res.on('end', () => {
            callback(null, Buffer.concat(chunks));
          });
          res.on('error', callback);
        }),
    post: (path: string, body?: object) =>
      request(BASE_URL)
        .post(`${API}${path}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send(body ?? {}),
    patch: (path: string, body?: object) =>
      request(BASE_URL)
        .patch(`${API}${path}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send(body ?? {}),
    put: (path: string, body?: object) =>
      request(BASE_URL)
        .put(`${API}${path}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send(body ?? {}),
    delete: (path: string) =>
      request(BASE_URL)
        .delete(`${API}${path}`)
        .set('Authorization', `Bearer ${token}`),
  };
}

export function unauthenticated() {
  return {
    get: (path: string) => request(BASE_URL).get(`${API}${path}`),
    post: (path: string, body?: object) =>
      request(BASE_URL)
        .post(`${API}${path}`)
        .set('Content-Type', 'application/json')
        .send(body ?? {}),
  };
}

export type NestAuthSessionData = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email?: string };
  profile: { role: string; id: string; email?: string | null };
};

/**
 * Login through Nest `POST /auth/login` (same validation as Supabase direct login).
 */
export async function loginViaNestApi(
  email: string,
  password: string,
): Promise<string> {
  const data = await loginViaNestApiFull(email, password);
  return data.access_token;
}

export async function loginViaNestApiFull(
  email: string,
  password: string,
): Promise<NestAuthSessionData> {
  const res = await unauthenticated().post('/auth/login', { email, password });
  if (res.status !== 200 || !res.body?.success || !res.body.data?.access_token) {
    throw new Error(
      `POST /auth/login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data as NestAuthSessionData;
}

export async function refreshViaNestApi(
  refreshToken: string,
): Promise<NestAuthSessionData> {
  const res = await unauthenticated().post('/auth/refresh', {
    refresh_token: refreshToken,
  });
  if (res.status !== 200 || !res.body?.success || !res.body.data?.access_token) {
    throw new Error(
      `POST /auth/refresh failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data as NestAuthSessionData;
}
