import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ActivityReport {
  visits: number;
  uniqueVisitors: number;
  participants: number;
  leads: number;
  totalStock: number;
  awarded: number;
  available: number;
  pending: number;
  redeemed: number;
  expired: number;
  channels: { code: string; visitors: number }[];
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  listRedemptions(activityId: string) {
    return this.dataSource.query(
      `SELECT l.id,l.prize_name,r.status,r.redeem_end_at,r.redeemed_at,s.display_name AS redeemed_by
       FROM lottery_record l JOIN redemption r ON r.lottery_record_id=l.id
       LEFT JOIN staff_account s ON s.id=r.redeemed_by_staff_id WHERE l.activity_id=$1 ORDER BY l.created_at DESC LIMIT 500`,
      [activityId],
    );
  }

  async get(activityId: string): Promise<ActivityReport> {
    const [traffic] = await this.dataSource.query<
      { visits: number; unique_visitors: number }[]
    >(
      `SELECT count(*)::int AS visits,count(DISTINCT user_id)::int AS unique_visitors FROM channel_visit WHERE activity_id=$1`,
      [activityId],
    );
    const [participation] = await this.dataSource.query<
      { participants: number; leads: number }[]
    >(
      `SELECT count(*)::int AS participants,count(*) FILTER (WHERE lead_completed)::int AS leads FROM activity_participation WHERE activity_id=$1`,
      [activityId],
    );
    const [inventory] = await this.dataSource.query<
      { total_stock: number; awarded: number }[]
    >(
      `SELECT COALESCE(sum(total_stock),0)::int AS total_stock,COALESCE(sum(awarded_stock),0)::int AS awarded FROM activity_prize WHERE activity_id=$1`,
      [activityId],
    );
    const [redemptions] = await this.dataSource.query<
      { pending: number; redeemed: number; expired: number }[]
    >(
      `SELECT count(*) FILTER (WHERE r.status='WAIT_REDEEM')::int AS pending,count(*) FILTER (WHERE r.status='REDEEMED')::int AS redeemed,count(*) FILTER (WHERE r.status='EXPIRED')::int AS expired FROM redemption r JOIN lottery_record l ON l.id=r.lottery_record_id WHERE l.activity_id=$1`,
      [activityId],
    );
    const channels = await this.dataSource.query<
      { code: string; visitors: number }[]
    >(
      `WITH first_visit AS (SELECT DISTINCT ON (user_id) user_id,channel_code FROM channel_visit WHERE activity_id=$1 AND user_id IS NOT NULL ORDER BY user_id,visited_at,id) SELECT channel_code AS code,count(*)::int AS visitors FROM first_visit GROUP BY channel_code ORDER BY channel_code`,
      [activityId],
    );
    const totalStock = inventory?.total_stock ?? 0;
    const awarded = inventory?.awarded ?? 0;

    return {
      visits: traffic?.visits ?? 0,
      uniqueVisitors: traffic?.unique_visitors ?? 0,
      participants: participation?.participants ?? 0,
      leads: participation?.leads ?? 0,
      totalStock,
      awarded,
      available: totalStock - awarded,
      pending: redemptions?.pending ?? 0,
      redeemed: redemptions?.redeemed ?? 0,
      expired: redemptions?.expired ?? 0,
      channels,
    };
  }
}
