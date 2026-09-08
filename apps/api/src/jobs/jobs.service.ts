import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { BackgroundJob } from '../../database/entities/index.js';

export interface FailedJobView {
  id: string;
  kind: string;
  attempts: number;
  status: 'FAILED';
  lastError: string | null;
  createdAt: Date;
}

@Injectable()
export class JobsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async enqueue(
    manager: EntityManager,
    kind: string,
    key: string,
    payload: unknown,
  ): Promise<string> {
    const id = randomUUID();
    await manager.query(
      `INSERT INTO background_job (id, kind, deduplication_key, payload) VALUES ($1,$2,$3,$4)
       ON CONFLICT (deduplication_key) DO NOTHING`,
      [id, kind, key, payload],
    );
    const job = await manager.getRepository(BackgroundJob).findOne({
      select: { id: true },
      where: { deduplicationKey: key },
    });
    if (!job) throw new Error('JOB_ENQUEUE_FAILED');
    return job.id;
  }

  async listFailed(): Promise<FailedJobView[]> {
    const rows = await this.dataSource.getRepository(BackgroundJob).find({
      select: {
        id: true,
        kind: true,
        attempts: true,
        status: true,
        lastError: true,
        createdAt: true,
      },
      where: { status: 'FAILED' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      attempts: row.attempts,
      status: 'FAILED',
      lastError: row.lastError,
      createdAt: row.createdAt,
    }));
  }

  async retry(id: string): Promise<void> {
    await this.dataSource.getRepository(BackgroundJob).update(
      { id, status: 'FAILED' },
      {
        status: 'PENDING',
        attempts: 0,
        availableAt: () => 'now()',
        leaseOwner: null,
        leaseUntil: null,
        lastError: null,
        updatedAt: () => 'now()',
      },
    );
  }
}
