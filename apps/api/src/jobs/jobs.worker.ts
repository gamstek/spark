import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { JobHandlers, type JobHandler } from './jobs.handlers.js';

export interface ClaimedJob {
  id: string;
  kind: string;
  payload: unknown;
  attempts: number;
}
const delays = [10, 30, 120, 600] as const;

function writeCount(result: unknown): number {
  if (!Array.isArray(result)) return 0;
  const last = result.at(-1);
  return typeof last === 'number' ? last : 0;
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'JOB_HANDLER_FAILED';
  return message
    .replace(/\b1\d{10}\b/g, '[redacted-phone]')
    .replace(/[\w.+-]+@[\w.-]+/g, '[redacted-email]')
    .slice(0, 200);
}

@Injectable()
export class JobsWorker {
  private readonly owner: string;
  private readonly localHandlers = new JobHandlers();

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Optional() owner?: string,
    @Optional()
    @Inject(JobHandlers)
    private readonly sharedHandlers?: JobHandlers,
  ) {
    this.owner = owner ?? `worker-${randomUUID()}`;
  }

  register(kind: string, handler: JobHandler): void {
    this.localHandlers.register(kind, handler);
  }

  async claimDueJob(now: Date): Promise<ClaimedJob | null> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.query<[ClaimedJob[], number]>(
        `WITH candidate AS (
           SELECT id FROM background_job
           WHERE attempts < 5 AND ((status='PENDING' AND available_at <= $1) OR (status='RUNNING' AND lease_until < $1))
           ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE background_job job SET status='RUNNING', lease_owner=$2, lease_until=$1 + interval '15 seconds',
           attempts=job.attempts+1, updated_at=$1 FROM candidate WHERE job.id=candidate.id
         RETURNING job.id, job.kind, job.payload, job.attempts`,
        [now, this.owner],
      );
      const first = result[0];
      return (Array.isArray(first) ? first[0] : first) ?? null;
    });
  }

  async complete(id: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `UPDATE background_job SET status='SUCCEEDED', lease_owner=NULL, lease_until=NULL, updated_at=now()
       WHERE id=$1 AND status='RUNNING' AND lease_owner=$2`,
      [id, this.owner],
    );
    return writeCount(result) === 1;
  }

  private async fail(
    job: ClaimedJob,
    error: unknown,
    now: Date,
  ): Promise<void> {
    const terminal = job.attempts >= 5;
    const delaySeconds =
      delays[Math.min(job.attempts - 1, delays.length - 1)] ?? 600;
    await this.dataSource.query(
      `UPDATE background_job SET status=$3, available_at=$4, lease_owner=NULL, lease_until=NULL, last_error=$5, updated_at=$2
       WHERE id=$1 AND status='RUNNING' AND lease_owner=$6`,
      [
        job.id,
        now,
        terminal ? 'FAILED' : 'PENDING',
        new Date(now.getTime() + delaySeconds * 1000),
        sanitizeError(error),
        this.owner,
      ],
    );
    if (job.kind === 'EXPORT_ACTIVITY') {
      const exportId = (job.payload as { exportId?: string }).exportId;
      if (exportId) {
        await this.dataSource.query(
          `UPDATE export_job SET status=$2,completed_at=CASE WHEN $2='FAILED' THEN $3 ELSE NULL END WHERE id=$1`,
          [exportId, terminal ? 'FAILED' : 'PENDING', now],
        );
        if (terminal) {
          await this.dataSource.query(
            `INSERT INTO audit_event (id,actor_type,actor_id,action,resource_type,resource_id,details)
             SELECT $1,'ADMIN',requested_by_admin_id,'EXPORT_FAILED','export_job',id,$2 FROM export_job WHERE id=$3`,
            [randomUUID(), { error: sanitizeError(error) }, exportId],
          );
        }
      }
    }
  }

  async runDueJobs(now: Date): Promise<number> {
    let processed = 0;
    while (true) {
      const job = await this.claimDueJob(now);
      if (!job) return processed;
      const handler =
        this.localHandlers.get(job.kind) ?? this.sharedHandlers?.get(job.kind);
      try {
        if (!handler) throw new Error(`JOB_HANDLER_MISSING:${job.kind}`);
        await handler(job.payload);
        await this.complete(job.id);
      } catch (error) {
        await this.fail(job, error, now);
      }
      processed += 1;
    }
  }
}
