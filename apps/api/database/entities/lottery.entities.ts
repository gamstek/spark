import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'prize' })
export class Prize {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ name: 'image_asset_id', type: 'uuid', nullable: true })
  imageAssetId!: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'activity_prize' })
@Unique('activity_prize_activity_prize_key', ['activityId', 'prizeId'])
export class ActivityPrize {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_id', type: 'uuid' }) activityId!: string;
  @Column({ name: 'prize_id', type: 'uuid' }) prizeId!: string;
  @Column({ name: 'prize_name', type: 'varchar', length: 120 })
  prizeName!: string;
  @Column({ name: 'prize_image_url', type: 'text', nullable: true })
  prizeImageUrl!: string | null;
  @Column({ name: 'total_stock', type: 'integer' }) totalStock!: number;
  @Column({ name: 'awarded_stock', type: 'integer', default: 0 })
  awardedStock!: number;
  @Column({ type: 'numeric', precision: 14, scale: 6 }) weight!: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'lottery_record' })
@Unique('lottery_record_activity_user_key', ['activityId', 'userId'])
export class LotteryRecord {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_id', type: 'uuid' }) activityId!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'participation_id', type: 'uuid', unique: true })
  participationId!: string;
  @Column({ name: 'activity_prize_id', type: 'uuid' })
  activityPrizeId!: string;
  @Column({ name: 'prize_name', type: 'varchar', length: 120, nullable: true })
  prizeName!: string | null;
  @Column({ name: 'prize_image_url', type: 'text', nullable: true })
  prizeImageUrl!: string | null;
  @Column({ name: 'redeem_end_at', type: 'timestamptz', nullable: true })
  redeemEndAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'redemption' })
@Index('redemption_status_end_idx', ['status', 'redeemEndAt'])
export class Redemption {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'lottery_record_id', type: 'uuid', unique: true })
  lotteryRecordId!: string;
  @Column({
    name: 'redeem_code_hash',
    type: 'varchar',
    length: 128,
    unique: true,
  })
  redeemCodeHash!: string;
  @Column({ type: 'varchar', length: 20 }) status!: string;
  @Column({ name: 'redeem_end_at', type: 'timestamptz' }) redeemEndAt!: Date;
  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt!: Date | null;
  @Column({ name: 'redeemed_by_staff_id', type: 'uuid', nullable: true })
  redeemedByStaffId!: string | null;
  @Column({ name: 'encrypted_code', type: 'text', nullable: true })
  encryptedCode!: string | null;
  @Column({
    name: 'encryption_key_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  encryptionKeyId!: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'stock_adjustment' })
@Index('stock_adjustment_operation_idx', ['operationId'], {
  unique: true,
  where: 'operation_id IS NOT NULL',
})
export class StockAdjustment {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_prize_id', type: 'uuid' })
  activityPrizeId!: string;
  @Column({ type: 'integer' }) quantity!: number;
  @Column({ type: 'varchar', length: 500 }) reason!: string;
  @Column({ name: 'admin_account_id', type: 'uuid' })
  adminAccountId!: string;
  @Column({ name: 'operation_id', type: 'uuid', nullable: true })
  operationId!: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
