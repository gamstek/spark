import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { JobsService } from '../src/jobs/jobs.service.js';
import { JobsWorker } from '../src/jobs/jobs.worker.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

describe('durable PostgreSQL jobs', () => {
  let database: TestDatabase;
  let jobs: JobsService;

  beforeAll(async () => {
    database = await createTestDatabase();
    jobs = new JobsService(database.dataSource);
  });

  afterAll(async () => database.close());

  it('rolls back an enqueued job with its caller transaction', async () => {
    await expect(
      database.dataSource.transaction(async (manager) => {
        await jobs.enqueue(manager, 'ROLLBACK', 'rollback-key', { value: 1 });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    const rows = await database.dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM background_job WHERE deduplication_key='rollback-key'`,
    );
    expect(Number(rows[0]?.count)).toBe(0);
  });

  it('deduplicates enqueue by key', async () => {
    await database.dataSource.transaction(async (manager) => {
      const firstId = await jobs.enqueue(manager, 'ONCE', 'same-key', {
        first: true,
      });
      const secondId = await jobs.enqueue(manager, 'ONCE', 'same-key', {
        first: false,
      });
      expect(secondId).toBe(firstId);
    });
    const rows = await database.dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM background_job WHERE deduplication_key='same-key'`,
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it('lets only one concurrent worker claim a job', async () => {
    await database.dataSource.query(
      `UPDATE background_job SET status='SUCCEEDED' WHERE deduplication_key='same-key'`,
    );
    await database.dataSource.transaction((manager) =>
      jobs.enqueue(manager, 'CONCURRENT', 'concurrent-key', {}),
    );
    const workerA = new JobsWorker(database.dataSource, 'worker-a');
    const workerB = new JobsWorker(database.dataSource, 'worker-b');
    const [a, b] = await Promise.all([
      workerA.claimDueJob(new Date()),
      workerB.claimDueJob(new Date()),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('recovers an expired lease and rejects completion by the old owner', async () => {
    await database.dataSource.transaction((manager) =>
      jobs.enqueue(manager, 'RECOVER', 'recover-key', {}),
    );
    const oldWorker = new JobsWorker(database.dataSource, 'old-worker');
    const claimed = await oldWorker.claimDueJob(new Date());
    expect(claimed).not.toBeNull();
    await database.dataSource.query(
      `UPDATE background_job SET lease_until=now() - interval '1 second' WHERE id=$1`,
      [claimed?.id],
    );
    const newWorker = new JobsWorker(database.dataSource, 'new-worker');
    const reclaimed = await newWorker.claimDueJob(new Date());
    expect(reclaimed?.id).toBe(claimed?.id);
    await expect(oldWorker.complete(claimed!.id)).resolves.toBe(false);
    await expect(newWorker.complete(claimed!.id)).resolves.toBe(true);
  });

  it('retries with backoff, stops after five attempts, and can replay original payload', async () => {
    await database.dataSource.transaction((manager) =>
      jobs.enqueue(manager, 'FAIL', 'failure-key', { safe: 'original' }),
    );
    const worker = new JobsWorker(database.dataSource, 'failure-worker');
    worker.register('FAIL', async () => {
      throw new Error('phone 13800138000 failed');
    });
    let now = new Date();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await worker.runDueJobs(now);
      now = new Date(now.getTime() + 11 * 60 * 1000);
    }
    const failed = await jobs.listFailed();
    const job = failed.find((item) => item.kind === 'FAIL');
    expect(job).toMatchObject({ attempts: 5, status: 'FAILED' });
    expect(job?.lastError).not.toContain('13800138000');
    await jobs.retry(job!.id);
    const replayed = await database.dataSource.query<
      {
        payload: { safe: string };
        attempts: number;
        status: string;
        lease_owner: string | null;
        lease_until: Date | null;
        last_error: string | null;
      }[]
    >(`SELECT * FROM background_job WHERE id=$1`, [job!.id]);
    expect(replayed[0]).toMatchObject({
      payload: { safe: 'original' },
      attempts: 0,
      status: 'PENDING',
      lease_owner: null,
      lease_until: null,
      last_error: null,
    });
  });

  it('does not retry a job that is no longer failed', async () => {
    const id = await database.dataSource.transaction((manager) =>
      jobs.enqueue(manager, 'SUCCEEDED', 'do-not-retry-key', {}),
    );
    await database.dataSource.query(
      `UPDATE background_job SET status='SUCCEEDED', attempts=2 WHERE id=$1`,
      [id],
    );

    await jobs.retry(id);

    const rows = await database.dataSource.query<
      { status: string; attempts: number }[]
    >(`SELECT status, attempts FROM background_job WHERE id=$1`, [id]);
    expect(rows[0]).toEqual({ status: 'SUCCEEDED', attempts: 2 });
  });
});
