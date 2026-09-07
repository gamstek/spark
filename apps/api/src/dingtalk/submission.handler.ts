import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { JobHandlers } from '../jobs/jobs.handlers.js';

@Injectable()
export class DingTalkSubmissionHandler implements OnModuleInit {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(JobHandlers) private readonly handlers: JobHandlers,
  ) {}
  onModuleInit(): void {
    this.handlers.register('DINGTALK_SUBMISSION', (payload) =>
      this.handle(payload),
    );
  }

  async handle(payload: unknown): Promise<void> {
    const participationId = (payload as { participationId?: string })
      .participationId;
    if (!participationId) throw new Error('INVALID_DINGTALK_JOB');
    await this.dataSource.transaction(async (manager) => {
      const participations = await manager.query<
        { id: string; lead_completed: boolean }[]
      >(
        `SELECT id,lead_completed FROM activity_participation WHERE id=$1 FOR UPDATE`,
        [participationId],
      );
      if (!participations[0]) throw new Error('PARTICIPATION_NOT_FOUND');
      const receipts = await manager.query<
        {
          form_id: string;
          record_id: string;
          payload: { fields: Record<string, unknown> };
          received_at: Date;
        }[]
      >(
        `SELECT r.form_id,r.record_id,r.payload,r.received_at FROM webhook_receipt r LEFT JOIN dingtalk_form_submission s ON s.form_id=r.form_id AND s.record_id=r.record_id WHERE r.participation_id=$1 AND s.id IS NULL ORDER BY r.received_at,r.id FOR UPDATE OF r`,
        [participationId],
      );
      for (const receipt of receipts) {
        const id = randomUUID();
        await manager.query(
          `INSERT INTO dingtalk_form_submission (id,form_id,record_id,participation_id,fields,submitted_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (form_id,record_id) DO NOTHING`,
          [
            id,
            receipt.form_id,
            receipt.record_id,
            participationId,
            receipt.payload.fields,
            receipt.received_at,
          ],
        );
        if (!participations[0].lead_completed) {
          await manager.query(
            `UPDATE activity_participation SET lead_completed=true,lead_completed_at=$2,adopted_submission_id=$3,updated_at=now() WHERE id=$1 AND lead_completed=false`,
            [participationId, receipt.received_at, id],
          );
          participations[0].lead_completed = true;
        }
      }
    });
  }
}
