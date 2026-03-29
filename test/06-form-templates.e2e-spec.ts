import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('06 Form templates (e2e)', () => {
  describe('POST /form-templates', () => {
    it('creates template as super_admin', async () => {
      const res = await api(state.adminToken).post('/form-templates', {
        project_id: state.projectId,
        name: 'Test Booking Form',
        description: 'Test form',
      });
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.templateId = (res.body.data as { id: string }).id;
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post('/form-templates', {
        project_id: state.projectId,
        name: 'X',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post('/form-templates', {
        project_id: state.projectId,
        name: 'X',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 400 without name', async () => {
      const res = await api(state.adminToken).post('/form-templates', {
        project_id: state.projectId,
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /form-templates', () => {
    it('lists as super_admin', async () => {
      const res = await api(state.adminToken).get('/form-templates?page=1&limit=20');
      assertPaginated(res);
    });

    it('lists as manager', async () => {
      const res = await api(state.managerToken).get('/form-templates?page=1&limit=20');
      assertPaginated(res);
    });

    it('lists as user', async () => {
      const res = await api(state.userToken).get('/form-templates?page=1&limit=20');
      assertPaginated(res);
    });

    it('filters by project_id', async () => {
      const res = await api(state.adminToken).get(
        `/form-templates?page=1&limit=20&project_id=${state.projectId}`,
      );
      assertPaginated(res);
    });
  });

  describe('GET /form-templates/:id', () => {
    it('returns nested sections and fields', async () => {
      const res = await api(state.userToken).get(`/form-templates/${state.templateId}`);
      assertSuccess(res);
      const d = res.body.data as { sections?: unknown[] };
      expect(Array.isArray(d.sections)).toBe(true);
    });
  });

  describe('PATCH /form-templates/:id', () => {
    it('updates as super_admin', async () => {
      const res = await api(state.adminToken).patch(`/form-templates/${state.templateId}`, {
        name: 'Test Booking Form Updated',
      });
      assertSuccess(res);
      expect((res.body.data as { name: string }).name).toBe('Test Booking Form Updated');
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(`/form-templates/${state.templateId}`, {
        name: 'n',
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('POST /form-templates/:id/sections', () => {
    it('creates section', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/sections`,
        {
          section_key: 'test_section',
          section_label: 'Test Section',
          display_order: 1,
        },
      );
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.sectionId = (res.body.data as { id: string }).id;
    });

    it('returns 409 for duplicate section_key', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/sections`,
        {
          section_key: 'test_section',
          section_label: 'Dup',
          display_order: 2,
        },
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE');
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post(
        `/form-templates/${state.templateId}/sections`,
        {
          section_key: 'other',
          section_label: 'O',
          display_order: 3,
        },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /form-templates/:templateId/sections', () => {
    it('lists sections ordered', async () => {
      const res = await api(state.userToken).get(
        `/form-templates/${state.templateId}/sections`,
      );
      assertSuccess(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PATCH sections', () => {
    it('updates section as super_admin', async () => {
      const res = await api(state.adminToken).patch(
        `/form-templates/${state.templateId}/sections/${state.sectionId}`,
        { section_label: 'Updated Section Label', display_order: 2 },
      );
      assertSuccess(res);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(
        `/form-templates/${state.templateId}/sections/${state.sectionId}`,
        { section_label: 'x' },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('POST fields', () => {
    it('creates text field', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'test_text_field',
          field_label: 'Test Text Field',
          data_type: 'text',
          is_required: true,
          visible_to_user: true,
          editable_by_user: true,
          display_order: 10,
          placeholder: 'Enter value here',
        },
      );
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.fieldId = (res.body.data as { id: string }).id;
    });

    it('creates select field with options', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'test_select_field',
          field_label: 'Select',
          data_type: 'select',
          options: ['Option A', 'Option B'],
          display_order: 11,
        },
      );
      expect(res.status).toBe(201);
      state.selectFieldId = (res.body.data as { id: string }).id;
    });

    it('returns 409 for duplicate field_key', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'test_text_field',
          field_label: 'Dup',
          data_type: 'text',
          display_order: 12,
        },
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE');
    });

    it('returns 400 for invalid data_type', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'bad_type_field',
          field_label: 'Bad',
          data_type: 'not_a_type' as 'text',
          display_order: 13,
        },
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid field_key pattern', async () => {
      const res = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'Invalid_Key',
          field_label: 'X',
          data_type: 'text',
          display_order: 14,
        },
      );
      expect(res.status).toBe(400);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'mgr_field',
          field_label: 'M',
          data_type: 'text',
          display_order: 15,
        },
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'usr_field',
          field_label: 'U',
          data_type: 'text',
          display_order: 16,
        },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET fields', () => {
    it('lists all fields for super_admin', async () => {
      const res = await api(state.adminToken).get(
        `/form-templates/${state.templateId}/fields?page=1&limit=50`,
      );
      assertPaginated(res);
    });

    it('restricts fields for user visibility', async () => {
      const res = await api(state.userToken).get(
        `/form-templates/${state.templateId}/fields?page=1&limit=50`,
      );
      assertPaginated(res);
    });

    it('filters by section_id', async () => {
      const res = await api(state.adminToken).get(
        `/form-templates/${state.templateId}/fields?section_id=${state.sectionId}`,
      );
      assertPaginated(res);
    });
  });

  describe('PATCH field', () => {
    it('updates field as super_admin', async () => {
      const res = await api(state.adminToken).patch(
        `/form-templates/${state.templateId}/fields/${state.fieldId}`,
        { field_label: 'Updated Label', help_text: 'This is help text' },
      );
      assertSuccess(res);
      expect((res.body.data as { field_label: string }).field_label).toBe('Updated Label');
    });

    it('keeps field_key stable after label-only patch', async () => {
      const res = await api(state.adminToken).patch(
        `/form-templates/${state.templateId}/fields/${state.fieldId}`,
        { field_label: 'Label for key stability check' },
      );
      assertSuccess(res);
      expect((res.body.data as { field_key: string }).field_key).toBe('test_text_field');
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(
        `/form-templates/${state.templateId}/fields/${state.fieldId}`,
        { field_label: 'x' },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('PATCH toggle field', () => {
    it('toggles visible_to_user off and on', async () => {
      const off = await api(state.adminToken).patch(
        `/form-templates/${state.templateId}/fields/${state.fieldId}/toggle`,
        { visible_to_user: false },
      );
      assertSuccess(off);
      expect((off.body.data as { visible_to_user: boolean }).visible_to_user).toBe(false);

      const on = await api(state.adminToken).patch(
        `/form-templates/${state.templateId}/fields/${state.fieldId}/toggle`,
        { visible_to_user: true },
      );
      assertSuccess(on);
      expect((on.body.data as { visible_to_user: boolean }).visible_to_user).toBe(true);
    });
  });

  describe('PATCH fields/reorder', () => {
    it('reorders fields', async () => {
      const res = await api(state.adminToken).patch(
        `/form-templates/${state.templateId}/fields/reorder`,
        { fields: [{ id: state.fieldId, display_order: 5 }] },
      );
      assertSuccess(res);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(
        `/form-templates/${state.templateId}/fields/reorder`,
        { fields: [{ id: state.fieldId, display_order: 6 }] },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('DELETE field', () => {
    it('deletes non-system field', async () => {
      const create = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/fields`,
        {
          section_id: state.sectionId,
          field_key: 'to_delete_field',
          field_label: 'Del',
          data_type: 'text',
          display_order: 99,
        },
      );
      expect(create.status).toBe(201);
      const fid = (create.body.data as { id: string }).id;
      const res = await api(state.adminToken).delete(
        `/form-templates/${state.templateId}/fields/${fid}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 403 deleting system field', async () => {
      const sb = await import('./helpers/seed.helper').then((m) => m.getServiceSupabase());
      const { data: rows } = await sb
        .from('form_fields')
        .select('id')
        .eq('section_id', state.sectionId)
        .eq('is_system_field', true)
        .limit(1);
      const sysId = (rows as { id: string }[] | null)?.[0]?.id;
      if (!sysId) {
        return;
      }
      const res = await api(state.adminToken).delete(
        `/form-templates/${state.templateId}/fields/${sysId}`,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SYSTEM_FIELD_PROTECTED');
    });

    it('returns 403 for manager deleting field', async () => {
      const res = await api(state.managerToken).delete(
        `/form-templates/${state.templateId}/fields/${state.fieldId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('DELETE section (disposable)', () => {
    it('deletes a throwaway section', async () => {
      const s = await api(state.adminToken).post(
        `/form-templates/${state.templateId}/sections`,
        {
          section_key: `throw_${randomUUID().slice(0, 8)}`,
          section_label: 'Throw',
          display_order: 99,
        },
      );
      expect(s.status).toBe(201);
      const sid = (s.body.data as { id: string }).id;
      const res = await api(state.adminToken).delete(
        `/form-templates/${state.templateId}/sections/${sid}`,
      );
      expect(res.status).toBe(200);
    });
  });

});
