import { describe, expect, it, vi } from 'vitest';

import { JobsRunner } from './jobs.runner.js';

describe('JobsRunner', () => {
  it('starts polling, prevents overlapping runs, and stops cleanly', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const worker = {
      runDueJobs: vi.fn(
        () => new Promise<number>((resolve) => (release = () => resolve(1))),
      ),
    };
    const runner = new JobsRunner(worker as never, 100);

    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(300);
    expect(worker.runDueJobs).toHaveBeenCalledTimes(1);

    release();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(worker.runDueJobs).toHaveBeenCalledTimes(2);

    runner.onApplicationShutdown();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
