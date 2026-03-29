import { Response } from 'supertest';

export function assertSuccess(res: Response, statusCode = 200): void {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(true);
  expect(res.body).toHaveProperty('data');
}

export function assertError(
  res: Response,
  statusCode: number,
  errorCode?: string,
): void {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(false);
  expect(res.body).toHaveProperty('error');
  expect(res.body.error).toHaveProperty('message');
  if (errorCode) {
    expect(res.body.error.code).toBe(errorCode);
  }
}

export function assertPaginated(res: Response): void {
  assertSuccess(res);
  expect(res.body).toHaveProperty('meta');
  expect(res.body.meta).toHaveProperty('total');
  expect(res.body.meta).toHaveProperty('page');
  expect(res.body.meta).toHaveProperty('limit');
  expect(Array.isArray(res.body.data)).toBe(true);
}
