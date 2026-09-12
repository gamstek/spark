import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { StaffRecordView } from '@spark/contracts';
import { DataSource } from 'typeorm';

import { CodeService } from './code.service.js';

export interface RedemptionView {
  lotteryRecordId: string;
  activityId: string;
  prizeName: string;
  prizeImageUrl: string | null;
  status: 'WAIT_REDEEM' | 'REDEEMED' | 'EXPIRED';
  redeemEndAt: string;
  redeemedAt: string | null;
  userHint: string;
}

/** Mask participant PII before it leaves the API. */
export function maskName(name: unknown): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '匿名';
  if (trimmed.length === 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

export function maskPhone(phone: unknown): string {
  const trimmed = String(phone ?? '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  return trimmed ? `${trimmed.slice(0, 2)}****` : '';
}

type RedemptionRow = {
  redemption_id: string;
  lottery_record_id: string;
  activity_id: string;
  user_id: string;
  prize_name: string;
  prize_image_url: string | null;
  status: RedemptionView['status'];
  redeem_end_at: Date;
  redeemed_at: Date | null;
};

@Injectable()
export class RedemptionsService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(CodeService) private readonly codes: CodeService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getOwnCode(
    userId: string,
    activityCode: string,
    origin = 'http://localhost',
  ): Promise<{ code: string; qrUrl: string }> {
    await this.dataSource.query(
      `UPDATE redemption r SET status='EXPIRED' FROM lottery_record l,activity a
       WHERE r.lottery_record_id=l.id AND a.id=l.activity_id AND l.user_id=$1 AND a.code=$2
         AND r.status='WAIT_REDEEM' AND r.redeem_end_at<=$3`,
      [userId, activityCode, this.now()],
    );
    const rows = await this.dataSource.query<
      {
        encrypted_code: string | null;
        encryption_key_id: string | null;
        status: RedemptionView['status'];
      }[]
    >(
      `SELECT r.encrypted_code,r.encryption_key_id,r.status FROM redemption r JOIN lottery_record l ON l.id=r.lottery_record_id JOIN activity a ON a.id=l.activity_id WHERE l.user_id=$1 AND a.code=$2`,
      [userId, activityCode],
    );
    const row = rows[0];
    if (!row?.encrypted_code || !row.encryption_key_id)
      throw new Error('PRIZE_CODE_NOT_FOUND');
    if (row.status !== 'WAIT_REDEEM')
      throw new Error('PRIZE_CODE_NOT_AVAILABLE');
    const code = this.codes.restore(row.encrypted_code, row.encryption_key_id);
    return {
      code,
      qrUrl: new URL(
        `/staff?code=${encodeURIComponent(code)}`,
        origin,
      ).toString(),
    };
  }

  async lookup(code: string, staffId: string): Promise<RedemptionView> {
    await this.expire(code, staffId);
    const rows = await this.dataSource.query<RedemptionRow[]>(
      this.lookupSql(false),
      [this.hash(code), staffId],
    );
    if (!rows[0]) throw new Error('REDEMPTION_NOT_FOUND');
    return this.toView(rows[0]);
  }

  /** Redemption history for the staff to-do list (masked PII, newest first). */
  async listRecords(
    staffId: string,
    activityId: string | null,
  ): Promise<StaffRecordView[]> {
    const rows = await this.dataSource.query<
      {
        redemption_id: string;
        activity_id: string;
        activity_code: string;
        activity_name: string;
        prize_name: string;
        prize_image_url: string | null;
        status: StaffRecordView['status'];
        won_at: Date;
        redeemed_at: Date | null;
        lead_fields: { name?: unknown; phone?: unknown } | null;
      }[]
    >(
      `SELECT r.id AS redemption_id,l.activity_id,a.code AS activity_code,a.name AS activity_name,
         l.prize_name,l.prize_image_url,r.status,l.created_at AS won_at,r.redeemed_at,
         lead.answers AS lead_fields
       FROM redemption r
       JOIN lottery_record l ON l.id=r.lottery_record_id
       JOIN activity a ON a.id=l.activity_id
       JOIN staff_activity_permission p ON p.activity_id=l.activity_id AND p.staff_account_id=$1
       LEFT JOIN activity_participation ap ON ap.id=l.participation_id
       LEFT JOIN activity_form_submission lead ON lead.participation_id=ap.id
       WHERE ($2::uuid IS NULL OR l.activity_id=$2)
       ORDER BY COALESCE(r.redeemed_at,l.created_at) DESC
       LIMIT 500`,
      [staffId, activityId],
    );
    return rows.map((row) => ({
      id: row.redemption_id,
      activityId: row.activity_id,
      activityCode: row.activity_code,
      activityName: row.activity_name,
      name: maskName(row.lead_fields?.name),
      phone: maskPhone(row.lead_fields?.phone),
      prizeName: row.prize_name,
      prizeImageUrl: row.prize_image_url,
      status: row.status,
      wonAt: new Date(row.won_at).toISOString(),
      redeemedAt: row.redeemed_at
        ? new Date(row.redeemed_at).toISOString()
        : null,
    }));
  }

  async confirm(code: string, staffId: string): Promise<RedemptionView> {
    await this.expire(code, staffId);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<RedemptionRow[]>(this.lookupSql(true), [
        this.hash(code),
        staffId,
      ]);
      const row = rows[0];
      if (!row) throw new Error('REDEMPTION_NOT_FOUND');
      if (row.status === 'REDEEMED') return this.toView(row);
      if (row.status === 'EXPIRED') throw new Error('REDEMPTION_EXPIRED');
      const redeemedAt = this.now();
      await manager.query(
        `UPDATE redemption SET status='REDEEMED',redeemed_at=$2,redeemed_by_staff_id=$3 WHERE id=$1 AND status='WAIT_REDEEM'`,
        [row.redemption_id, redeemedAt, staffId],
      );
      await manager.query(
        `INSERT INTO audit_event (id,actor_type,actor_id,action,resource_type,resource_id,details) VALUES ($1,'STAFF',$2,'REDEMPTION_CONFIRMED','redemption',$3,$4)`,
        [
          randomUUID(),
          staffId,
          row.redemption_id,
          { activityId: row.activity_id },
        ],
      );
      return this.toView({
        ...row,
        status: 'REDEEMED',
        redeemed_at: redeemedAt,
      });
    });
  }

  private hash(code: string): string {
    return createHash('sha256')
      .update(code.replace(/[\s-]/g, '').toUpperCase())
      .digest('hex');
  }
  private async expire(code: string, staffId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE redemption r SET status='EXPIRED' FROM lottery_record l,staff_activity_permission p
       WHERE r.lottery_record_id=l.id AND p.activity_id=l.activity_id AND p.staff_account_id=$2
         AND r.redeem_code_hash=$1 AND r.status='WAIT_REDEEM' AND r.redeem_end_at<=$3`,
      [this.hash(code), staffId, this.now()],
    );
  }
  private lookupSql(lock: boolean): string {
    return `SELECT r.id AS redemption_id,l.id AS lottery_record_id,l.activity_id,l.user_id,l.prize_name,l.prize_image_url,r.status,r.redeem_end_at,r.redeemed_at
      FROM redemption r JOIN lottery_record l ON l.id=r.lottery_record_id JOIN staff_activity_permission p ON p.activity_id=l.activity_id
      WHERE r.redeem_code_hash=$1 AND p.staff_account_id=$2${lock ? ' FOR UPDATE OF r' : ''}`;
  }
  private toView(row: RedemptionRow): RedemptionView {
    return {
      lotteryRecordId: row.lottery_record_id,
      activityId: row.activity_id,
      prizeName: row.prize_name,
      prizeImageUrl: row.prize_image_url,
      status: row.status,
      redeemEndAt: new Date(row.redeem_end_at).toISOString(),
      redeemedAt: row.redeemed_at
        ? new Date(row.redeemed_at).toISOString()
        : null,
      userHint: `用户…${row.user_id.slice(-4)}`,
    };
  }
}
