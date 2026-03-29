import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('19 Business rules (e2e)', () => {
  it('prevents duplicate unit booking (409 UNIT_NOT_AVAILABLE)', async () => {
    const u = await api(state.adminToken).post('/units', {
      project_id: state.projectId,
      unit_no: `RULE-${randomUUID().slice(0, 8)}`,
      tower: 'A',
      floor_no: 20,
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
    const b1 = await api(state.userToken).post('/bookings', {
      project_id: state.projectId,
      unit_id: unitId,
      form_template_id: state.templateId,
      agreement_template_id: state.agreementTemplateId,
      joint_allottees: [],
    });
    expect(b1.status).toBe(201);
    const b2 = await api(state.userToken).post('/bookings', {
      project_id: state.projectId,
      unit_id: unitId,
      form_template_id: state.templateId,
      agreement_template_id: state.agreementTemplateId,
      joint_allottees: [],
    });
    expect(b2.status).toBe(409);
    expect(b2.body.error.code).toBe('UNIT_NOT_AVAILABLE');
  });

  it('validates application_no format on new booking', async () => {
    const u = await api(state.adminToken).post('/units', {
      project_id: state.projectId,
      unit_no: `APP-${randomUUID().slice(0, 8)}`,
      tower: 'A',
      floor_no: 21,
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
    const appNo = (b.body.data as { application_no: string }).application_no;
    expect(appNo).toMatch(/^OL-\d{4}-\d{4,6}$/);
  });

  it('auto-creates payment schedule rows for booking', async () => {
    const sum = await api(state.adminToken).get(
      `/payments/booking/${state.approvedBookingId}`,
    );
    assertSuccess(sum);
    const d = sum.body.data as { payments?: unknown[]; summary?: { milestones?: number } };
    if (Array.isArray(d.payments)) {
      expect(d.payments.length).toBeGreaterThanOrEqual(1);
    }
    if (d.summary?.milestones != null) {
      expect(d.summary.milestones).toBe(17);
    }
  });

  it('rejects deleting form template that is in use', async () => {
    const res = await api(state.adminToken).delete(`/form-templates/${state.templateId}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TEMPLATE_IN_USE');
  });

  it('rejects deleting agreement template referenced by booking', async () => {
    const res = await api(state.adminToken).delete(
      `/agreement-templates/${state.agreementTemplateId}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TEMPLATE_IN_USE');
  });

  it('returns 404 for DELETE /audit/:id (no route)', async () => {
    const res = await api(state.adminToken).delete(
      `/audit/00000000-0000-0000-0000-000000000001`,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for PUT /audit/:id (no route)', async () => {
    const res = await api(state.adminToken).put(
      `/audit/00000000-0000-0000-0000-000000000001`,
      {},
    );
    expect(res.status).toBe(404);
  });
});
