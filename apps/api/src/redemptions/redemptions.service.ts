import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { CodeService } from './code.service.js';

export interface RedemptionView {
  lotteryRecordId: string; activityId: string; prizeName: string; prizeImageUrl: string | null;
  status: 'WAIT_REDEEM' | 'REDEEMED' | 'EXPIRED'; redeemEndAt: string; redeemedAt: string | null; userHint: string;
}

type RedemptionRow = {
  redemption_id: string; lottery_record_id: string; activity_id: string; user_id: string; prize_name: string;
  prize_image_url: string | null; status: RedemptionView['status']; redeem_end_at: Date; redeemed_at: Date | null;
};

@Injectable()
export class RedemptionsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Inject(CodeService) private readonly codes: CodeService, private readonly now: () => Date = () => new Date()) {}

  async getOwnCode(userId: string, activityCode: string): Promise<{ code: string; qrUrl: string }> {
    const rows = await this.dataSource.query<{ encrypted_code: string | null; encryption_key_id: string | null }[]>(
      `SELECT r.encrypted_code,r.encryption_key_id FROM redemption r JOIN lottery_record l ON l.id=r.lottery_record_id JOIN activity a ON a.id=l.activity_id WHERE l.user_id=$1 AND a.code=$2`, [userId, activityCode],
    );
    const row = rows[0];
    if (!row?.encrypted_code || !row.encryption_key_id) throw new Error('PRIZE_CODE_NOT_FOUND');
    const code = this.codes.restore(row.encrypted_code, row.encryption_key_id);
    const origin = process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173';
    return { code, qrUrl: new URL(`/staff?code=${encodeURIComponent(code)}`, origin).toString() };
  }

  async lookup(code: string, staffId: string): Promise<RedemptionView> {
    const rows = await this.dataSource.query<RedemptionRow[]>(this.lookupSql(false), [this.hash(code), staffId]);
    if (!rows[0]) throw new Error('REDEMPTION_NOT_FOUND');
    return this.toView(rows[0]);
  }

  async confirm(code: string, staffId: string): Promise<RedemptionView> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<RedemptionRow[]>(this.lookupSql(true), [this.hash(code), staffId]);
      const row = rows[0];
      if (!row) throw new Error('REDEMPTION_NOT_FOUND');
      if (row.status === 'REDEEMED') return this.toView(row);
      if (row.status === 'EXPIRED' || this.now() >= new Date(row.redeem_end_at)) throw new Error('REDEMPTION_EXPIRED');
      const redeemedAt = this.now();
      await manager.query(`UPDATE redemption SET status='REDEEMED',redeemed_at=$2,redeemed_by_staff_id=$3 WHERE id=$1 AND status='WAIT_REDEEM'`, [row.redemption_id, redeemedAt, staffId]);
      await manager.query(`INSERT INTO audit_event (id,actor_type,actor_id,action,resource_type,resource_id,details) VALUES ($1,'STAFF',$2,'REDEMPTION_CONFIRMED','redemption',$3,$4)`, [randomUUID(), staffId, row.redemption_id, { activityId: row.activity_id }]);
      return this.toView({ ...row, status: 'REDEEMED', redeemed_at: redeemedAt });
    });
  }

  private hash(code: string): string { return createHash('sha256').update(code.trim()).digest('hex'); }
  private lookupSql(lock: boolean): string {
    return `SELECT r.id AS redemption_id,l.id AS lottery_record_id,l.activity_id,l.user_id,l.prize_name,l.prize_image_url,r.status,r.redeem_end_at,r.redeemed_at
      FROM redemption r JOIN lottery_record l ON l.id=r.lottery_record_id JOIN staff_activity_permission p ON p.activity_id=l.activity_id
      WHERE r.redeem_code_hash=$1 AND p.staff_account_id=$2${lock ? ' FOR UPDATE OF r' : ''}`;
  }
  private toView(row: RedemptionRow): RedemptionView {
    return { lotteryRecordId: row.lottery_record_id, activityId: row.activity_id, prizeName: row.prize_name, prizeImageUrl: row.prize_image_url,
      status: row.status, redeemEndAt: new Date(row.redeem_end_at).toISOString(), redeemedAt: row.redeemed_at ? new Date(row.redeemed_at).toISOString() : null,
      userHint: `用户…${row.user_id.slice(-4)}` };
  }
}
