import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

const agreementBody = {
  name: 'Test Agreement v1',
  description: 'Test agreement template',
  body_html: '<p>Agreement for {{allottee_full_name}} for apartment {{apartment_no}}</p>',
  header_html: '<h1>ORCHID LIFE</h1>',
  footer_html: '<p>Page {{page}}</p>',
  page_size: 'A4',
  margin_top: 72,
  is_active: true,
};

describe('07 Agreement templates (e2e)', () => {
  describe('POST /agreement-templates', () => {
    it('creates template as super_admin', async () => {
      const res = await api(state.adminToken).post('/agreement-templates', {
        project_id: state.projectId,
        ...agreementBody,
      });
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
      state.agreementTemplateId = (res.body.data as { id: string }).id;
    });

    it('returns 400 without body_html', async () => {
      const res = await api(state.adminToken).post('/agreement-templates', {
        project_id: state.projectId,
        name: 'x',
        description: 'd',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 without project_id', async () => {
      const res = await api(state.adminToken).post('/agreement-templates', {
        ...agreementBody,
      } as Record<string, unknown>);
      expect(res.status).toBe(400);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).post('/agreement-templates', {
        project_id: state.projectId,
        ...agreementBody,
        name: 'M',
      });
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post('/agreement-templates', {
        project_id: state.projectId,
        ...agreementBody,
        name: 'U',
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('GET /agreement-templates', () => {
    it('lists without body_html in rows', async () => {
      const res = await api(state.adminToken).get('/agreement-templates?page=1&limit=20');
      assertPaginated(res);
      const row = (res.body.data as Record<string, unknown>[])[0];
      if (row) {
        expect(row).not.toHaveProperty('body_html');
      }
    });

    it('lists as manager', async () => {
      const res = await api(state.managerToken).get('/agreement-templates?page=1&limit=20');
      assertPaginated(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get('/agreement-templates');
      assertError(res, 403, 'FORBIDDEN');
    });

    it('filters project_id', async () => {
      const res = await api(state.adminToken).get(
        `/agreement-templates?project_id=${state.projectId}`,
      );
      assertPaginated(res);
    });
  });

  describe('GET /agreement-templates/:id', () => {
    it('includes body_html for super_admin', async () => {
      const res = await api(state.adminToken).get(
        `/agreement-templates/${state.agreementTemplateId}`,
      );
      assertSuccess(res);
      expect((res.body.data as { body_html?: string }).body_html).toBeDefined();
    });

    it('includes body_html for manager', async () => {
      const res = await api(state.managerToken).get(
        `/agreement-templates/${state.agreementTemplateId}`,
      );
      assertSuccess(res);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).get(
        `/agreement-templates/${state.agreementTemplateId}`,
      );
      assertError(res, 403, 'FORBIDDEN');
    });

    it('returns 404 for bad id', async () => {
      const res = await api(state.adminToken).get(
        `/agreement-templates/${randomUUID()}`,
      );
      assertError(res, 404, 'AGREEMENT_TEMPLATE_NOT_FOUND');
    });
  });

  describe('PATCH /agreement-templates/:id', () => {
    it('bumps version on update', async () => {
      const res = await api(state.adminToken).patch(
        `/agreement-templates/${state.agreementTemplateId}`,
        {
          name: 'Test Agreement v1 Updated',
          body_html: '<p>Updated HTML {{allottee_full_name}}</p>',
        },
      );
      assertSuccess(res);
      expect((res.body.data as { version: number }).version).toBeGreaterThanOrEqual(2);
    });

    it('returns 403 for manager', async () => {
      const res = await api(state.managerToken).patch(
        `/agreement-templates/${state.agreementTemplateId}`,
        { name: 'x' },
      );
      assertError(res, 403, 'FORBIDDEN');
    });
  });

  describe('DELETE /agreement-templates/:id', () => {
    it('deletes unused template', async () => {
      const create = await api(state.adminToken).post('/agreement-templates', {
        project_id: state.projectId,
        name: 'Disposable AT',
        description: 'd',
        body_html: '<p>x</p>',
      });
      expect(create.status).toBe(201);
      const id = (create.body.data as { id: string }).id;
      const res = await api(state.adminToken).delete(`/agreement-templates/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

  });
});
