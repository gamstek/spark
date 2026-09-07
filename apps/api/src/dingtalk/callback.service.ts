import { timingSafeEqual, randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { CallbackInputSchema, type CallbackInput } from '@spark/contracts';
import { DataSource } from 'typeorm';

import { JobsService } from '../jobs/jobs.service.js';

export type { CallbackInput } from '@spark/contracts';

function secretsMatch(actual: string, expected: string): boolean {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class DingTalkCallbackService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Inject(JobsService) private readonly jobs: JobsService) {}

  async accept(input: CallbackInput, secret: string): Promise<{ accepted: true }> {
    if (!secretsMatch(secret, process.env.DINGTALK_CALLBACK_SECRET ?? '')) throw new UnauthorizedException('CALLBACK_UNAUTHORIZED');
    const result = CallbackInputSchema.safeParse(input);
    if (!result.success) throw new BadRequestException('CALLBACK_INVALID');
    const parsed = result.data;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const existing = await manager.query<{ participation_id: string }[]>(`SELECT participation_id FROM webhook_receipt WHERE form_id=$1 AND record_id=$2 FOR UPDATE`, [parsed.formId, parsed.recordId]);
        if (existing[0]) {
          if (existing[0].participation_id !== parsed.participationId) throw new ConflictException('RECORD_PARTICIPATION_CONFLICT');
          return { accepted: true as const };
        }
        const bound = await manager.query<{ id: string }[]>(
          `SELECT p.id FROM activity_participation p JOIN activity a ON a.id=p.activity_id JOIN activity_version v ON v.id=a.published_version_id WHERE p.id=$1 AND v.config->>'formId'=$2`,
          [parsed.participationId, parsed.formId],
        );
        if (!bound[0]) throw new ConflictException('FORM_PARTICIPATION_MISMATCH');
        const receiptId = randomUUID();
        await manager.query(`INSERT INTO webhook_receipt (id,form_id,record_id,participation_id,payload) VALUES ($1,$2,$3,$4,$5)`, [receiptId, parsed.formId, parsed.recordId, parsed.participationId, parsed]);
        await this.jobs.enqueue(manager, 'DINGTALK_SUBMISSION', `dingtalk:${parsed.formId}:${parsed.recordId}`, { participationId: parsed.participationId });
        return { accepted: true as const };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('CALLBACK_NOT_PERSISTED');
    }
  }
}
