import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

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
    const rows = await manager.query<{ id: string }[]>(
      `SELECT id FROM background_job WHERE deduplication_key=$1`,
      [key],
    );
    if (!rows[0]) throw new Error('JOB_ENQUEUE_FAILED');
    return rows[0].id;
  }

  async listFailed(): Promise<FailedJobView[]> {
    const rows = await this.dataSource.query<
      {
        id: string;
        kind: string;
        attempts: number;
        status: 'FAILED';
        last_error: string | null;
        created_at: Date;
      }[]
    >(
      `SELECT id, kind, attempts, status, last_error, created_at FROM background_job WHERE status='FAILED' ORDER BY created_at DESC LIMIT 100`,
    );
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      attempts: row.attempts,
      status: row.status,
      lastError: row.last_error,
      createdAt: row.created_at,
    }));
  }

  async retry(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE background_job SET status='PENDING', attempts=0, available_at=now(), lease_owner=NULL, lease_until=NULL, last_error=NULL, updated_at=now()
       WHERE id=$1 AND status='FAILED'`,
      [id],
    );
  }
}
