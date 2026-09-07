import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'media_asset' })
export class MediaAsset {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'storage_key', type: 'text', unique: true })
  storageKey!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;
  @Column({ name: 'byte_size', type: 'bigint' }) byteSize!: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'activity' })
export class Activity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 64, unique: true }) code!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ name: 'draft_version_id', type: 'uuid', nullable: true })
  draftVersionId!: string | null;
  @Column({ name: 'published_version_id', type: 'uuid', nullable: true })
  publishedVersionId!: string | null;
  @Column({ type: 'integer', default: 0 }) revision!: number;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

@Entity({ name: 'activity_version' })
@Unique('activity_version_activity_version_key', ['activityId', 'version'])
@Index('activity_version_time_idx', ['startsAt', 'endsAt'])
export class ActivityVersion {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_id', type: 'uuid' }) activityId!: string;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'varchar', length: 16 }) status!: string;
  @Column({ name: 'template_id', type: 'varchar', length: 64 })
  templateId!: string;
  @Column({ name: 'template_version', type: 'integer' })
  templateVersion!: number;
  @Column({ name: 'config_schema_version', type: 'integer' })
  configSchemaVersion!: number;
  @Column({ type: 'jsonb' }) config!: Record<string, unknown>;
  @Column({ name: 'starts_at', type: 'timestamptz' }) startsAt!: Date;
  @Column({ name: 'ends_at', type: 'timestamptz' }) endsAt!: Date;
  @Column({ name: 'draw_ends_at', type: 'timestamptz' }) drawEndsAt!: Date;
  @Column({ name: 'redeem_ends_at', type: 'timestamptz' })
  redeemEndsAt!: Date;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
  @Column({ name: 'activity_name', type: 'varchar', length: 120, default: '' })
  activityName!: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'activity_version_prize' })
@Unique('activity_version_prize_version_prize_key', [
  'activityVersionId',
  'activityPrizeId',
])
@Index('activity_version_prize_version_idx', [
  'activityVersionId',
  'activityPrizeId',
])
export class ActivityVersionPrize {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_version_id', type: 'uuid' })
  activityVersionId!: string;
  @Column({ name: 'activity_prize_id', type: 'uuid' })
  activityPrizeId!: string;
  @Column({ name: 'prize_name', type: 'varchar', length: 120 })
  prizeName!: string;
  @Column({ name: 'prize_image_url', type: 'text', nullable: true })
  prizeImageUrl!: string | null;
  @Column({ type: 'numeric', precision: 12, scale: 6 }) weight!: string;
}

@Entity({ name: 'staff_activity_permission' })
export class StaffActivityPermission {
  @PrimaryColumn({ name: 'staff_account_id', type: 'uuid' })
  staffAccountId!: string;
  @PrimaryColumn({ name: 'activity_id', type: 'uuid' }) activityId!: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
