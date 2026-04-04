import { api } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('12 Agreement merge & record (e2e)', () => {
  it('returns merged agreement for approved booking', async () => {
    const res = await api(state.managerToken).get(
      `/bookings/${state.approvedBookingId}/merged-agreement`,
    );
    assertSuccess(res);
    const d = res.body.data as {
      merged_html?: string;
      header_html?: string;
      footer_html?: string;
      page_size?: string;
      booking_id?: string;
    };
    expect(d.merged_html).toBeDefined();
    expect(String(d.merged_html)).not.toContain('{{allottee_full_name}}');
    expect(d.booking_id ?? state.approvedBookingId).toBeTruthy();
  });

  it('returns 422 merged agreement when not approved', async () => {
    const res = await api(state.managerToken).get(
      `/bookings/${state.secondaryBookingId}/merged-agreement`,
    );
    expect(res.status).toBe(422);
  });

  it('returns 403 for user merged agreement', async () => {
    const res = await api(state.userToken).get(
      `/bookings/${state.approvedBookingId}/merged-agreement`,
    );
    assertError(res, 403, 'FORBIDDEN');
  });

  it('allows super_admin merged agreement', async () => {
    const res = await api(state.adminToken).get(
      `/bookings/${state.approvedBookingId}/merged-agreement`,
    );
    assertSuccess(res);
  });

  it(
    'downloads merged agreement as PDF (default)',
    async () => {
      const res = await api(state.managerToken).getBuffer(
        `/bookings/${state.approvedBookingId}/agreement-download`,
      );
      expect(res.status).toBe(200);
      expect(String(res.headers['content-type'] ?? '')).toMatch(
        /application\/pdf/i,
      );
      expect(String(res.headers['content-disposition'] ?? '')).toMatch(
        /\.pdf/i,
      );
      const body = res.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    },
    300_000,
  );

  it('downloads merged agreement HTML when format=html', async () => {
    const res = await api(state.managerToken).get(
      `/bookings/${state.approvedBookingId}/agreement-download?format=html`,
    );
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] ?? '')).toMatch(/text\/html/i);
    expect(String(res.headers['content-disposition'] ?? '')).toMatch(
      /attachment/i,
    );
    const body = String(res.text ?? '');
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).not.toContain('{{allottee_full_name}}');
  });

  it('records agreement document as manager', async () => {
    const res = await api(state.managerToken).post(
      `/bookings/${state.approvedBookingId}/record-agreement`,
      {
        storage_path: `agreements/${state.approvedBookingId}/v1/agreement.pdf`,
        file_name: 'Agreement-OL-TEST.pdf',
        size_bytes: 204800,
        preview_url: 'https://example.com/preview/agreement.pdf',
      },
    );
    expect(res.status).toBe(200);
    const docId = (res.body.data as { document_id?: string })?.document_id;
    expect(docId).toBeDefined();
    state.agreementDocumentId = docId ?? '';

    const get = await api(state.managerToken).get(`/bookings/${state.approvedBookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('agreement_generated');
  });

  it('returns 422 record-agreement when booking not approved', async () => {
    const res = await api(state.managerToken).post(
      `/bookings/${state.secondaryBookingId}/record-agreement`,
      {
        storage_path: 'x',
        file_name: 'a.pdf',
        size_bytes: 1,
      },
    );
    expect(res.status).toBe(422);
  });

  it('returns 403 when user records agreement', async () => {
    const res = await api(state.userToken).post(
      `/bookings/${state.approvedBookingId}/record-agreement`,
      {
        storage_path: 'x',
        file_name: 'a.pdf',
        size_bytes: 1,
      },
    );
    assertError(res, 403, 'FORBIDDEN');
  });

  it('returns 400 when record-agreement missing fields', async () => {
    const res = await api(state.managerToken).post(
      `/bookings/${state.approvedBookingId}/record-agreement`,
      { file_name: 'test.pdf' } as Record<string, string>,
    );
    expect(res.status).toBe(400);
  });

  it('marks agreement printed as manager', async () => {
    const res = await api(state.managerToken).patch(
      `/bookings/${state.approvedBookingId}/mark-printed`,
    );
    expect(res.status).toBe(200);
    expect((res.body as { success?: boolean }).success ?? res.body.data?.success).toBe(true);

    const get = await api(state.managerToken).get(`/bookings/${state.approvedBookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('agreement_printed');
  });

  it('returns 403 when user marks printed', async () => {
    const res = await api(state.userToken).patch(
      `/bookings/${state.approvedBookingId}/mark-printed`,
    );
    assertError(res, 403, 'FORBIDDEN');
  });

  it('returns 422 mark-printed when wrong status', async () => {
    const res = await api(state.managerToken).patch(
      `/bookings/${state.secondaryBookingId}/mark-printed`,
    );
    expect(res.status).toBe(422);
  });
});
