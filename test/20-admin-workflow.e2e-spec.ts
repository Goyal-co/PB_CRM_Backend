import { randomUUID } from 'crypto';
import { api } from './helpers/auth.helper';
import { assertError, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

/**
 * Super-admin flows: user directory, invitations (admin_create_user RPC),
 * project roster, project assignment (covered in 02 as well; sanity check here).
 */
describe('20 Admin workflow — directory, invite, roster (e2e)', () => {
  it('GET /admin/users-directory returns for super_admin', async () => {
    const res = await api(state.adminToken).get('/admin/users-directory?page=1&limit=20');
    assertSuccess(res);
  });

  it('GET /admin/users-directory filters by project_id', async () => {
    const res = await api(state.adminToken).get(
      `/admin/users-directory?page=1&limit=20&project_id=${state.projectId}`,
    );
    assertSuccess(res);
  });

  it('POST /admin/invitations records pending invitation', async () => {
    const email = `e2e-invite-${randomUUID().slice(0, 8)}@orchidlife.in`;
    const res = await api(state.adminToken).post('/admin/invitations', {
      email,
      role: 'user',
      first_name: 'E2E',
      last_name: 'Invited',
      phone: '9999999900',
      project_ids: [state.projectId],
      manager_id: state.managerId,
    });
    expect(res.status).toBe(201);
    assertSuccess(res, 201);
    const d = res.body.data as { success?: boolean; invitation_id?: string };
    expect(d.success !== false).toBe(true);
  });

  it('GET /admin/projects/:projectId/user-summary returns for super_admin', async () => {
    const res = await api(state.adminToken).get(
      `/admin/projects/${state.projectId}/user-summary`,
    );
    assertSuccess(res);
  });

  it('POST /admin/users/:userId/project-assignments is idempotent for existing user', async () => {
    const res = await api(state.adminToken).post(
      `/admin/users/${state.userId}/project-assignments`,
      { project_id: state.projectId },
    );
    assertSuccess(res, 200);
  });

  it('rejects admin routes for manager', async () => {
    const res = await api(state.managerToken).get('/admin/users-directory?page=1&limit=5');
    assertError(res, 403, 'FORBIDDEN');
  });
});
