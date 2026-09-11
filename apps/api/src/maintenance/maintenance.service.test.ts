import { describe, expect, it, vi } from 'vitest';

import { MaintenanceService } from './maintenance.service.js';

describe('MaintenanceService', () => {
  it('removes transient expired data and expires redemptions', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = new MaintenanceService({ query } as never, 60_000);

    await service.runOnce();

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SET status='EXPIRED'"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM app_session'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM oauth_state'),
    );
    expect(query).toHaveBeenCalledTimes(3);
  });
});
