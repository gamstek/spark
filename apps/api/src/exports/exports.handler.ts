import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { JobHandlers } from '../jobs/jobs.handlers.js';

type Row = {
  id: string;
  user_id: string;
  lead_completed_at: Date | null;
  fields: Record<string, unknown> | null;
  prize_name: string | null;
  status: string | null;
  redeemed_at: Date | null;
};

@Injectable()
export class ExportsHandler implements OnModuleInit {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(JobHandlers) private readonly handlers: JobHandlers,
    private readonly root = process.env.PRIVATE_EXPORT_ROOT ??
      join(process.cwd(), 'private', 'exports'),
  ) {}

  onModuleInit() {
    this.handlers.register('EXPORT_ACTIVITY', (payload) =>
      this.handle(payload),
    );
  }

  async handle(payload: unknown) {
    const exportId = (payload as { exportId?: string }).exportId;
    if (!exportId) throw new Error('INVALID_EXPORT_JOB');
    const jobs = await this.dataSource.query<
      { activity_id: string; snapshot_at: Date }[]
    >(`SELECT activity_id,snapshot_at FROM export_job WHERE id=$1`, [exportId]);
    const job = jobs[0];
    if (!job) throw new Error('EXPORT_NOT_FOUND');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('活动线索');

    sheet.columns = [
      { header: '参与ID', key: 'id', width: 38 },
      { header: '用户ID', key: 'userId', width: 38 },
      { header: '姓名', key: 'name', width: 20 },
      { header: '手机号', key: 'phone', width: 20, style: { numFmt: '@' } },
      { header: '首次留资时间', key: 'leadAt', width: 24 },
      { header: '奖品', key: 'prize', width: 24 },
      { header: '兑奖状态', key: 'status', width: 16 },
      { header: '核销时间', key: 'redeemedAt', width: 24 },
    ];
    let cursor: string | null = null;
    let count = 0;

    while (true) {
      const rows: Row[] = await this.dataSource.query(
        `SELECT p.id,p.user_id,p.lead_completed_at,s.fields,l.prize_name,r.status,r.redeemed_at FROM activity_participation p LEFT JOIN dingtalk_form_submission s ON s.id=p.adopted_submission_id LEFT JOIN lottery_record l ON l.participation_id=p.id LEFT JOIN redemption r ON r.lottery_record_id=l.id WHERE p.activity_id=$1 AND p.created_at<=$2 AND ($3::uuid IS NULL OR p.id>$3) ORDER BY p.id LIMIT 500`,
        [job.activity_id, job.snapshot_at, cursor],
      );
      if (!rows.length) break;
      for (const row of rows) {
        const safe = (value: unknown) =>
          typeof value === 'string' ? value : String(value ?? '');
        sheet.addRow({
          id: row.id,
          userId: row.user_id,
          name: safe(row.fields?.name),
          phone: safe(row.fields?.phone),
          leadAt: row.lead_completed_at?.toISOString() ?? '',
          prize: row.prize_name ?? '',
          status: row.status ?? '',
          redeemedAt: row.redeemed_at?.toISOString() ?? '',
        });
        count++;
      }
      cursor = rows.at(-1)!.id;
    }
    await mkdir(this.root, { recursive: true });
    const storageKey = `${exportId}.xlsx`;
    await workbook.xlsx.writeFile(join(this.root, storageKey));
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE export_job SET status='SUCCEEDED',storage_key=$2,row_count=$3,completed_at=now() WHERE id=$1`,
        [exportId, storageKey, count],
      );
      await manager.query(
        `INSERT INTO audit_event (id,actor_type,actor_id,action,resource_type,resource_id,details) SELECT $1,'ADMIN',requested_by_admin_id,'EXPORT_COMPLETED','export_job',id,$2 FROM export_job WHERE id=$3`,
        [
          randomUUID(),
          {
            activityId: job.activity_id,
            rowCount: count,
            snapshotAt: job.snapshot_at,
          },
          exportId,
        ],
      );
    });
  }
}
