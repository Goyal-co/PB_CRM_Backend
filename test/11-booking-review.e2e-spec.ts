import { api } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('11 Booking review (e2e)', () => {
  it('starts review as manager', async () => {
    const res = await api(state.managerToken).post(
      `/bookings/${state.bookingId}/start-review`,
    );
    expect(res.status).toBe(200);
    expect((res.body as { success?: boolean }).success ?? res.body.data?.success).toBe(
      true,
    );

    const get = await api(state.managerToken).get(`/bookings/${state.bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('under_review');
  });

  it('returns 422 when starting review again', async () => {
    const res = await api(state.managerToken).post(
      `/bookings/${state.bookingId}/start-review`,
    );
    expect(res.status).toBe(422);
  });

  it('returns 403 when user starts review', async () => {
    const res = await api(state.userToken).post(
      `/bookings/${state.bookingId}/start-review`,
    );
    assertError(res, 403, 'FORBIDDEN');
  });

  it('manager marks field ok then needs_revision', async () => {
    const ok = await api(state.managerToken).patch(
      `/bookings/${state.bookingId}/review-field`,
      {
        field_id: state.fieldId,
        status: 'ok',
        note: 'Looks correct',
      },
    );
    expect(ok.status).toBe(200);

    const rev = await api(state.managerToken).patch(
      `/bookings/${state.bookingId}/review-field`,
      {
        field_id: state.fieldId,
        status: 'needs_revision',
        note: 'Please correct Aadhar number',
      },
    );
    expect(rev.status).toBe(200);
  });

  it('returns 403 when user reviews field', async () => {
    const res = await api(state.userToken).patch(
      `/bookings/${state.bookingId}/review-field`,
      {
        field_id: state.fieldId,
        status: 'ok',
      },
    );
    assertError(res, 403, 'FORBIDDEN');
  });

  it('returns 400 for invalid review status', async () => {
    const res = await api(state.managerToken).patch(
      `/bookings/${state.bookingId}/review-field`,
      {
        field_id: state.fieldId,
        status: 'invalid_status' as 'ok',
      },
    );
    expect(res.status).toBe(400);
  });

  it('request_revision moves booking to revision_requested', async () => {
    const res = await api(state.managerToken).patch(
      `/bookings/${state.bookingId}/complete-review`,
      {
        action: 'request_revision',
        notes: 'Please fix Aadhar number',
      },
    );
    expect(res.status).toBe(200);

    const get = await api(state.userToken).get(`/bookings/${state.bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('revision_requested');
  });

  it('user fixes field and resubmits after revision', async () => {
    await api(state.userToken).put(`/field-values/${state.bookingId}/${state.fieldId}`, {
      value_text: 'Corrected value',
    });
    await api(state.userToken).post(`/bookings/${state.bookingId}/submit`);
    const get = await api(state.userToken).get(`/bookings/${state.bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('submitted');
  });

  it('manager starts review again', async () => {
    const res = await api(state.managerToken).post(
      `/bookings/${state.bookingId}/start-review`,
    );
    expect(res.status).toBe(200);
    const get = await api(state.managerToken).get(`/bookings/${state.bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('under_review');
  });

  it('manager rejects booking', async () => {
    const res = await api(state.managerToken).patch(
      `/bookings/${state.bookingId}/complete-review`,
      {
        action: 'reject',
        notes: 'Documents invalid',
      },
    );
    expect(res.status).toBe(200);
    const get = await api(state.managerToken).get(`/bookings/${state.bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('rejected');
  });

  it('creates fresh booking for approval flow', async () => {
    const u = await api(state.adminToken).post('/units', {
      project_id: state.projectId,
      unit_no: `APR-${Date.now()}`,
      tower: 'A',
      floor_no: 11,
      unit_type: '3bhk',
      carpet_area_sqft: 1250,
      super_built_up_sqft: 1560,
      no_of_parking: 1,
      basic_rate_per_sqft: 7000,
      basic_sale_value: 10920000,
      maintenance_24mo: 224640,
      corpus_fund: 75000,
    });
    expect(u.status).toBe(201);
    const unitId = (u.body.data as { id: string }).id;

    const b = await api(state.userToken).post('/bookings', {
      project_id: state.projectId,
      unit_id: unitId,
      form_template_id: state.templateId,
      agreement_template_id: state.agreementTemplateId,
      allottee_phone: '9876543210',
      joint_allottees: [],
    });
    expect(b.status).toBe(201);
    const bookingId = (b.body.data as { id: string }).id;

    await api(state.userToken).put(`/field-values/${bookingId}/${state.fieldId}`, {
      value_text: 'Ready',
    });
    await api(state.userToken).post(`/bookings/${bookingId}/submit`);

    await api(state.managerToken).post(`/bookings/${bookingId}/start-review`);

    await api(state.managerToken).patch(`/bookings/${bookingId}/review-field`, {
      field_id: state.fieldId,
      status: 'ok',
      note: 'ok',
    });

    const appr = await api(state.managerToken).patch(
      `/bookings/${bookingId}/complete-review`,
      {
        action: 'approve',
        notes: 'All documents verified',
      },
    );
    expect(appr.status).toBe(200);

    const get = await api(state.adminToken).get(`/bookings/${bookingId}`);
    assertSuccess(get);
    expect((get.body.data as { status: string }).status).toBe('approved');
    state.approvedBookingId = bookingId;
  });

  it('returns 422 approving when fields need revision', async () => {
    const u = await api(state.adminToken).post('/units', {
      project_id: state.projectId,
      unit_no: `APP422-${Date.now()}`,
      tower: 'A',
      floor_no: 12,
      unit_type: '3bhk',
      carpet_area_sqft: 1250,
      super_built_up_sqft: 1560,
      no_of_parking: 1,
      basic_rate_per_sqft: 7000,
      basic_sale_value: 10920000,
      maintenance_24mo: 224640,
      corpus_fund: 75000,
    });
    expect(u.status).toBe(201);
    const unitId = (u.body.data as { id: string }).id;
    const b = await api(state.userToken).post('/bookings', {
      project_id: state.projectId,
      unit_id: unitId,
      form_template_id: state.templateId,
      agreement_template_id: state.agreementTemplateId,
      joint_allottees: [],
    });
    expect(b.status).toBe(201);
    const bookingId = (b.body.data as { id: string }).id;
    await api(state.userToken).put(`/field-values/${bookingId}/${state.fieldId}`, {
      value_text: 'x',
    });
    await api(state.userToken).post(`/bookings/${bookingId}/submit`);
    await api(state.managerToken).post(`/bookings/${bookingId}/start-review`);
    await api(state.managerToken).patch(`/bookings/${bookingId}/review-field`, {
      field_id: state.fieldId,
      status: 'needs_revision',
      note: 'fix',
    });
    const res = await api(state.managerToken).patch(
      `/bookings/${bookingId}/complete-review`,
      { action: 'approve', notes: 'should fail' },
    );
    expect(res.status).toBe(422);
  });

  it('returns 403 when user completes review', async () => {
    const res = await api(state.userToken).patch(
      `/bookings/${state.bookingId}/complete-review`,
      { action: 'approve' },
    );
    assertError(res, 403, 'FORBIDDEN');
  });

});
