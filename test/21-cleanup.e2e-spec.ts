import { getServiceSupabase } from './helpers/seed.helper';
import { state } from './shared-state';

describe('21 Cleanup test data (e2e)', () => {
  it('removes seeded project graph when possible', async () => {
    const sb = getServiceSupabase();
    const pid = state.projectId;
    if (!pid) {
      return;
    }

    await sb.from('manager_projects').delete().eq('project_id', pid);

    const { data: bookings } = await sb
      .from('bookings')
      .select('id')
      .eq('project_id', pid);
    const bids = (bookings as { id: string }[] | null)?.map((b) => b.id) ?? [];
    if (bids.length) {
      await sb.from('booking_field_values').delete().in('booking_id', bids);
      await sb.from('payments').delete().in('booking_id', bids);
      await sb.from('documents').delete().in('booking_id', bids);
      await sb.from('audit_logs').delete().in('booking_id', bids);
      await sb.from('bookings').delete().in('id', bids);
    }

    await sb.from('units').delete().eq('project_id', pid);
    await sb.from('form_templates').delete().eq('project_id', pid);
    await sb.from('agreement_templates').delete().eq('project_id', pid);
    await sb.from('projects').delete().eq('id', pid);

    expect(true).toBe(true);
  });
});
