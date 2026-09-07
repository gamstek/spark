import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportsCleanupService } from './exports-cleanup.service.js';
import type { ExportsService } from './exports.service.js';

describe('ExportsCleanupService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans at startup and once per hour until shutdown', async () => {
    vi.useFakeTimers();
    const cleanupExpired = vi.fn().mockResolvedValue(0);
    const service = new ExportsCleanupService({
      cleanupExpired,
    } as unknown as ExportsService);

    await service.onModuleInit();
    expect(cleanupExpired).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(cleanupExpired).toHaveBeenCalledTimes(2);

    service.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(cleanupExpired).toHaveBeenCalledTimes(2);
  });
});
