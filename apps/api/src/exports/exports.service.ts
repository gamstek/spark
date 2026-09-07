import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JobsService } from '../jobs/jobs.service.js';

export interface ExportView {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  downloadUrl: string | null;
  createdAt: string;
  rowCount: number | null;
}

@Injectable()
export class ExportsService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(JobsService) private readonly jobs: JobsService,
    private readonly root = process.env.PRIVATE_EXPORT_ROOT ??
      join(process.cwd(), 'private', 'exports'),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    activityId: string,
    adminId: string,
  ): Promise<{ jobId: string }> {
    const id = randomUUID();
    const snapshot = this.now();

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO export_job (id,requested_by_admin_id,activity_id,status,filters,snapshot_at,expires_at) VALUES ($1,$2,$3,'PENDING','{}',$4,$5)`,
        [
          id,
          adminId,
          activityId,
          snapshot,
          new Date(snapshot.getTime() + 86_400_000),
        ],
      );
      await this.jobs.enqueue(manager, 'EXPORT_ACTIVITY', `export:${id}`, {
        exportId: id,
      });
    });

    return { jobId: id };
  }

  async get(id: string, adminId: string): Promise<ExportView> {
    const rows = await this.dataSource.query<
      {
        id: string;
        status: ExportView['status'];
        created_at: Date;
        expires_at: Date | null;
        row_count: number | null;
      }[]
    >(
      `SELECT id,status,created_at,expires_at,row_count FROM export_job WHERE id=$1 AND requested_by_admin_id=$2`,
      [id, adminId],
    );
    const row = rows[0];
    if (!row) throw new Error('EXPORT_NOT_FOUND');
    const available =
      row.status === 'SUCCEEDED' &&
      row.expires_at &&
      this.now() < new Date(row.expires_at);
    return {
      id: row.id,
      status: row.status,
      downloadUrl: available
        ? new URL(
            `/api/admin/exports/${id}/download`,
            process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173',
          ).toString()
        : null,
      createdAt: new Date(row.created_at).toISOString(),
      rowCount: row.row_count,
    };
  }
  async read(
    id: string,
    adminId: string,
  ): Promise<{ path: string; filename: string }> {
    const rows = await this.dataSource.query<
      { storage_key: string; expires_at: Date }[]
    >(
      `SELECT storage_key,expires_at FROM export_job WHERE id=$1 AND requested_by_admin_id=$2 AND status='SUCCEEDED'`,
      [id, adminId],
    );
    const row = rows[0];
    if (!row || this.now() >= new Date(row.expires_at))
      throw new Error('EXPORT_NOT_FOUND');
    if (!/^[0-9a-f-]+\.xlsx$/i.test(row.storage_key))
      throw new Error('EXPORT_STORAGE_INVALID');
    return {
      path: join(this.root, row.storage_key),
      filename: `spark-export-${id}.xlsx`,
    };
  }
  async cleanupExpired(): Promise<number> {
    const rows = await this.dataSource.query<
      { id: string; storage_key: string | null }[]
    >(`SELECT id,storage_key FROM export_job WHERE expires_at<=now()`);
    for (const row of rows) {
      if (row.storage_key && /^[0-9a-f-]+\.xlsx$/i.test(row.storage_key)) {
        await unlink(join(this.root, row.storage_key)).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          },
        );
      }
      await this.dataSource.query(`DELETE FROM export_job WHERE id=$1`, [
        row.id,
      ]);
    }
    return rows.length;
  }
}
