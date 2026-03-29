import { api, BASE_URL } from './helpers/auth.helper';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

const pdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF',
);

describe('13 Documents (e2e)', () => {
  describe('GET /documents', () => {
    it('lists as super_admin', async () => {
      const res = await api(state.adminToken).get('/documents?page=1&limit=20');
      assertPaginated(res);
    });

    it('lists as manager with booking_id', async () => {
      const res = await api(state.managerToken).get(
        `/documents?page=1&limit=20&booking_id=${state.bookingId}`,
      );
      assertPaginated(res);
    });

    it('lists as user (own bookings)', async () => {
      const res = await api(state.userToken).get('/documents?page=1&limit=20');
      assertPaginated(res);
    });

    it('filters by booking_id', async () => {
      const res = await api(state.adminToken).get(
        `/documents?page=1&limit=20&booking_id=${state.bookingId}`,
      );
      assertPaginated(res);
    });
  });

  describe('GET /documents/:id', () => {
    it('returns document with url fields when authorized', async () => {
      if (!state.agreementDocumentId) {
        return;
      }
      const res = await api(state.adminToken).get(
        `/documents/${state.agreementDocumentId}`,
      );
      assertSuccess(res);
    });

    it('returns 404 for missing id', async () => {
      const res = await api(state.adminToken).get(
        `/documents/00000000-0000-0000-0000-000000000000`,
      );
      assertError(res, 404, 'DOCUMENT_NOT_FOUND');
    });
  });

  describe('POST /documents/upload', () => {
    it('uploads KYC pdf as user', async () => {
      const res = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.userToken}`)
        .field('booking_id', state.bookingId)
        .field('type', 'aadhar_card')
        .field('allottee_index', '0')
        .attach('file', pdfBuffer, { filename: 'aadhar.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      state.kycDocumentId = (res.body.data as { id: string }).id;
    });

    it('returns 403 uploading to another user booking', async () => {
      const res = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.userToken}`)
        .field('booking_id', state.secondaryBookingId)
        .field('type', 'aadhar_card')
        .field('allottee_index', '0')
        .attach('file', pdfBuffer, { filename: 'x.pdf', contentType: 'application/pdf' });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 when user uploads agreement_for_sale', async () => {
      const res = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.userToken}`)
        .field('booking_id', state.bookingId)
        .field('type', 'agreement_for_sale')
        .field('allottee_index', '0')
        .attach('file', pdfBuffer, { filename: 'a.pdf', contentType: 'application/pdf' });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 413 when file exceeds bucket limit', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024, 1);
      const res = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.userToken}`)
        .field('booking_id', state.bookingId)
        .field('type', 'aadhar_card')
        .field('allottee_index', '0')
        .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(413);
    });

    it('returns 415 for wrong mime type', async () => {
      const res = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.userToken}`)
        .field('booking_id', state.bookingId)
        .field('type', 'aadhar_card')
        .field('allottee_index', '0')
        .attach('file', Buffer.from('hello'), {
          filename: 'x.txt',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(415);
    });

    it('allows manager upload', async () => {
      const res = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.managerToken}`)
        .field('booking_id', state.bookingId)
        .field('type', 'pan_card')
        .field('allottee_index', '0')
        .attach('file', pdfBuffer, { filename: 'pan.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /documents/:id/verify', () => {
    it('verifies KYC as manager', async () => {
      if (!state.kycDocumentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/documents/${state.kycDocumentId}/verify`,
        { is_verified: true },
      );
      assertSuccess(res);
      expect((res.body.data as { is_verified: boolean }).is_verified).toBe(true);
    });

    it('rejects with reason', async () => {
      if (!state.kycDocumentId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/documents/${state.kycDocumentId}/verify`,
        {
          is_verified: false,
          rejection_reason: 'Document is blurry',
        },
      );
      assertSuccess(res);
      expect((res.body.data as { rejection_reason: string }).rejection_reason).toBe(
        'Document is blurry',
      );
    });

    it('returns 403 for user', async () => {
      if (!state.kycDocumentId) {
        return;
      }
      const res = await api(state.userToken).patch(
        `/documents/${state.kycDocumentId}/verify`,
        { is_verified: true },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /documents/:id/signed-url', () => {
    it('returns url payload', async () => {
      if (!state.kycDocumentId) {
        return;
      }
      const res = await api(state.userToken).get(
        `/documents/${state.kycDocumentId}/signed-url`,
      );
      assertSuccess(res);
      const url = (res.body.data as { url?: string })?.url;
      expect(String(url ?? '').startsWith('http')).toBe(true);
    });
  });

  describe('DELETE /documents/:id', () => {
    it('manager deletes non-agreement doc', async () => {
      const up = await request(BASE_URL)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${state.managerToken}`)
        .field('booking_id', state.bookingId)
        .field('type', 'pan_card')
        .field('allottee_index', '0')
        .attach('file', pdfBuffer, { filename: 'del.pdf', contentType: 'application/pdf' });
      expect(up.status).toBe(201);
      const id = (up.body.data as { id: string }).id;
      const res = await api(state.managerToken).delete(`/documents/${id}`);
      expect(res.status).toBe(200);
    });

    it('returns 403 deleting agreement_for_sale', async () => {
      if (!state.agreementDocumentId) {
        return;
      }
      const res = await api(state.managerToken).delete(
        `/documents/${state.agreementDocumentId}`,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AGREEMENT_LOCKED');
    });

    it('returns 403 for user delete', async () => {
      if (!state.kycDocumentId) {
        return;
      }
      const res = await api(state.userToken).delete(`/documents/${state.kycDocumentId}`);
      assertError(res, 403, 'FORBIDDEN');
    });
  });
});
