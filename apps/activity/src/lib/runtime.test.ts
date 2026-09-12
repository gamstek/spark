import { describe, expect, it, vi } from 'vitest';

import { refreshAcknowledgedForm } from './runtime';

describe('refreshAcknowledgedForm', () => {
  it('retains the acknowledgement after a failed refresh and clears it only after retry succeeds', async () => {
    const refreshRuntime = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const clearAcknowledgement = vi.fn();
    const reportFailure = vi.fn();

    await expect(
      refreshAcknowledgedForm(
        refreshRuntime,
        clearAcknowledgement,
        reportFailure,
      ),
    ).resolves.toBeUndefined();
    expect(clearAcknowledgement).not.toHaveBeenCalled();
    expect(reportFailure).toHaveBeenCalledWith(expect.any(Error));

    await refreshAcknowledgedForm(
      refreshRuntime,
      clearAcknowledgement,
      reportFailure,
    );
    expect(clearAcknowledgement).toHaveBeenCalledOnce();
    expect(reportFailure).toHaveBeenCalledOnce();
  });
});
