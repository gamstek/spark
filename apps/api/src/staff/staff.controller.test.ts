import { describe, expect, it, vi } from 'vitest';

import { StaffController } from './staff.controller.js';

describe('StaffController', () => {
  it('lists only permitted activities with their published schedule', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const controller = new StaffController({ query } as never);

    await controller.listActivities({ session: { subjectId: 'staff-1' } });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'JOIN activity_version version ON version.id=activity.published_version_id',
      ),
      ['staff-1'],
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      'version.starts_at AS "startsAt"',
    );
    expect(query.mock.calls[0]?.[0]).toContain('version.ends_at AS "endsAt"');
    expect(query.mock.calls[0]?.[0]).toContain(`version.config->>'rulesText'`);
  });
});
