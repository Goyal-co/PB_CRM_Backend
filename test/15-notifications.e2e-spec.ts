import { api } from './helpers/auth.helper';
import { assertError, assertPaginated, assertSuccess } from './helpers/assertions.helper';
import { state } from './shared-state';

describe('15 Notifications (e2e)', () => {
  describe('GET /notifications', () => {
    it('returns paginated notifications for user with unread_count', async () => {
      const res = await api(state.userToken).get('/notifications?page=1&limit=50');
      assertPaginated(res);
      expect(res.body.meta.unread_count).toBeDefined();
    });

    it('filters is_read=false', async () => {
      const res = await api(state.userToken).get(
        '/notifications?page=1&limit=50&is_read=false',
      );
      assertPaginated(res);
      for (const n of res.body.data as { is_read: boolean }[]) {
        expect(n.is_read).toBe(false);
      }
    });

    it('returns manager notifications', async () => {
      const res = await api(state.managerToken).get('/notifications?page=1&limit=50');
      assertPaginated(res);
    });

    it('returns super_admin notifications', async () => {
      const res = await api(state.adminToken).get('/notifications?page=1&limit=50');
      assertPaginated(res);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks own notification read', async () => {
      const list = await api(state.userToken).get(
        '/notifications?page=1&limit=1&is_read=false',
      );
      assertPaginated(list);
      const first = (list.body.data as { id: string }[])[0];
      if (!first) {
        return;
      }
      const res = await api(state.userToken).patch(`/notifications/${first.id}/read`);
      expect(res.status).toBe(200);
      state.notificationId = first.id;
    });

    it('returns 404 for another user notification id', async () => {
      if (!state.notificationId) {
        return;
      }
      const res = await api(state.managerToken).patch(
        `/notifications/${state.notificationId}/read`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /notifications/mark-all-read', () => {
    it('marks all read for user', async () => {
      const res = await api(state.userToken).patch('/notifications/mark-all-read');
      expect(res.status).toBe(200);
      expect((res.body.data as { count: number }).count).toBeGreaterThanOrEqual(0);

      const unread = await api(state.userToken).get(
        '/notifications?page=1&limit=20&is_read=false',
      );
      assertPaginated(unread);
      expect(unread.body.meta.total).toBe(0);
    });
  });

  describe('POST /notifications', () => {
    it('creates notification as manager', async () => {
      const res = await api(state.managerToken).post('/notifications', {
        user_id: state.userId,
        type: 'in_app',
        title: 'Test Notification',
        body: 'This is a test',
        booking_id: state.bookingId,
      });
      expect(res.status).toBe(201);
      assertSuccess(res, 201);
    });

    it('returns 403 for user', async () => {
      const res = await api(state.userToken).post('/notifications', {
        user_id: state.userId,
        type: 'in_app',
        title: 'x',
        body: 'y',
      });
      assertError(res, 403, 'FORBIDDEN');
    });
  });
});
