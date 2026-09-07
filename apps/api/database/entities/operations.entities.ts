import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'background_job' })
@Index('background_job_claim_idx', ['status', 'availableAt', 'leaseUntil'])
export class BackgroundJob {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 80 }) kind!: string;
  @Column({
    name: 'deduplication_key',
    type: 'varchar',
    length: 256,
    nullable: true,
    unique: true,
  })
  deduplicationKey!: string | null;
  @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
  @Column({ type: 'varchar', length: 16, default: 'PENDING' }) status!: string;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'now()' })
  availableAt!: Date;
  @Column({ name: 'lease_owner', type: 'varchar', length: 128, nullable: true })
  leaseOwner!: string | null;
  @Column({ name: 'lease_until', type: 'timestamptz', nullable: true })
  leaseUntil!: Date | null;
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

@Entity({ name: 'audit_event' })
@Index('audit_event_resource_idx', ['resourceType', 'resourceId', 'createdAt'])
export class AuditEvent {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'actor_type', type: 'varchar', length: 20 })
  actorType!: string;
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;
  @Column({ type: 'varchar', length: 100 }) action!: string;
  @Column({ name: 'resource_type', type: 'varchar', length: 100 })
  resourceType!: string;
  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId!: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'export_job' })
@Index('export_job_claim_idx', ['status', 'createdAt', 'leaseUntil'])
export class ExportJob {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'requested_by_admin_id', type: 'uuid' })
  requestedByAdminId!: string;
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId!: string | null;
  @Column({ type: 'varchar', length: 16, default: 'PENDING' }) status!: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  filters!: Record<string, unknown>;
  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey!: string | null;
  @Column({ name: 'lease_owner', type: 'varchar', length: 128, nullable: true })
  leaseOwner!: string | null;
  @Column({ name: 'lease_until', type: 'timestamptz', nullable: true })
  leaseUntil!: Date | null;
  @Column({ name: 'snapshot_at', type: 'timestamptz', nullable: true })
  snapshotAt!: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
  @Column({ name: 'row_count', type: 'integer', nullable: true })
  rowCount!: number | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
