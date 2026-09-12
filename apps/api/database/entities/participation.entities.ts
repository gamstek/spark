import type { ActivityFormAnswers } from '@spark/contracts';
import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'activity_participation' })
@Unique('activity_participation_activity_user_key', ['activityId', 'userId'])
export class ActivityParticipation {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_id', type: 'uuid' }) activityId!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'lead_completed', type: 'boolean', default: false })
  leadCompleted!: boolean;
  @Column({ name: 'lead_completed_at', type: 'timestamptz', nullable: true })
  leadCompletedAt!: Date | null;
  @Column({ name: 'drawn_at', type: 'timestamptz', nullable: true })
  drawnAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

@Entity({ name: 'activity_form_submission' })
@Unique('activity_form_submission_participation_key', ['participationId'])
export class ActivityFormSubmission {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'participation_id', type: 'uuid' })
  participationId!: string;
  @Column({ type: 'jsonb' }) answers!: ActivityFormAnswers;
  @Column({ name: 'submitted_at', type: 'timestamptz' }) submittedAt!: Date;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'channel_visit' })
@Index('channel_visit_activity_time_idx', ['activityId', 'visitedAt'])
export class ChannelVisit {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'activity_id', type: 'uuid' }) activityId!: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;
  @Column({ name: 'channel_code', type: 'varchar', length: 64 })
  channelCode!: string;
  @Column({ name: 'visited_at', type: 'timestamptz', default: () => 'now()' })
  visitedAt!: Date;
}
