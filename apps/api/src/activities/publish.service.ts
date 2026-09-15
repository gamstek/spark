import { randomUUID } from 'node:crypto';

import { deriveActivityStatus, type ActivityStatus } from '@spark/contracts';
import { getTemplate } from '@spark/templates';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { APP_CLOCK, type Clock, systemClock } from '../common/clock.js';

type LifecycleRow = {
  published_version_id: string | null;
  paused_at: Date | null;
  starts_at: Date | null;
  draw_ends_at: Date | null;
  ends_at: Date | null;
};

@Injectable()
export class PublishService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(APP_CLOCK)
    private readonly clock: Clock = systemClock,
  ) {}

  async publish(
    activityId: string,
    expectedRevision: number,
    adminId: string,
  ): Promise<{ version: number; revision: number }> {
    const now = this.now();
    return this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<
        {
          revision: number;
          draft_version_id: string | null;
          published_version_id: string | null;
          starts_at: Date | null;
        }[]
      >(
        `SELECT a.revision,a.draft_version_id,a.published_version_id,published.starts_at FROM activity a LEFT JOIN activity_version published ON published.id=a.published_version_id WHERE a.id=$1 FOR UPDATE OF a`,
        [activityId],
      );
      const activity = activities[0];
      if (!activity?.draft_version_id) throw new Error('DRAFT_NOT_FOUND');
      if (activity.revision !== expectedRevision)
        throw new Error('VERSION_CONFLICT');
      if (
        activity.starts_at &&
        new Date(activity.starts_at).getTime() <= now.getTime()
      )
        throw new Error('ACTIVITY_LOCKED');
      const versions = await manager.query<
        {
          version: number;
          template_id: string;
          template_version: number;
          config: unknown;
          starts_at: Date;
          draw_ends_at: Date;
          ends_at: Date;
          redeem_ends_at: Date;
        }[]
      >(`SELECT * FROM activity_version WHERE id=$1 FOR UPDATE`, [
        activity.draft_version_id,
      ]);
      const draft = versions[0];
      if (!draft) throw new Error('DRAFT_NOT_FOUND');
      const template = getTemplate(draft.template_id, draft.template_version);
      if (!template.configSchema.safeParse(draft.config).success)
        throw new Error('INVALID_TEMPLATE_CONFIG');
      if (!(
        draft.starts_at < draft.draw_ends_at &&
        draft.draw_ends_at <= draft.ends_at &&
        draft.redeem_ends_at >= draft.draw_ends_at
      ))
        throw new Error('INVALID_ACTIVITY_TIME');
      const prizeCount = await manager.query<{ count: string }[]>(
        `SELECT count(*) FROM activity_prize WHERE activity_id=$1 AND total_stock > 0`,
        [activityId],
      );
      if (Number(prizeCount[0]?.count ?? 0) === 0)
        throw new Error('PRIZE_REQUIRED');
      await manager.query(
        `UPDATE activity_prize ap SET prize_name=p.name, prize_image_url=CASE WHEN m.id IS NULL THEN NULL ELSE '/media/' || m.storage_key END
         FROM prize p LEFT JOIN media_asset m ON m.id=p.image_asset_id WHERE ap.activity_id=$1 AND p.id=ap.prize_id`,
        [activityId],
      );
      await manager.query(
        `DELETE FROM activity_version_prize WHERE activity_version_id=$1`,
        [activity.draft_version_id],
      );
      await manager.query(
        `INSERT INTO activity_version_prize (id,activity_version_id,activity_prize_id,prize_level,prize_name,prize_image_url,weight)
         SELECT gen_random_uuid(),$2,ap.id,ap.prize_level,ap.prize_name,ap.prize_image_url,ap.weight
         FROM activity_prize ap WHERE ap.activity_id=$1`,
        [activityId, activity.draft_version_id],
      );
      await manager.query(
        `UPDATE activity_version SET activity_name=(SELECT name FROM activity WHERE id=$2) WHERE id=$1`,
        [activity.draft_version_id, activityId],
      );
      if (activity.published_version_id)
        await manager.query(
          `UPDATE activity_version SET status='ARCHIVED' WHERE id=$1`,
          [activity.published_version_id],
        );
      await manager.query(
        `UPDATE activity_version SET status='PUBLISHED', published_at=now() WHERE id=$1`,
        [activity.draft_version_id],
      );
      await manager.query(
        `UPDATE activity SET published_version_id=draft_version_id, draft_version_id=NULL, revision=revision+1, updated_at=now() WHERE id=$1`,
        [activityId],
      );
      await manager.query(
        `INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id) VALUES ($1,'ADMIN',$2,'ACTIVITY_PUBLISHED','activity',$3)`,
        [randomUUID(), adminId, activityId],
      );
      return { version: draft.version, revision: expectedRevision + 1 };
    });
  }

  async endDraw(activityId: string, adminId: string): Promise<void> {
    const now = this.now();
    await this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<LifecycleRow[]>(
        `SELECT a.published_version_id,a.paused_at,v.starts_at,v.draw_ends_at,v.ends_at
         FROM activity a
         LEFT JOIN activity_version v ON v.id=a.published_version_id
         WHERE a.id=$1
         FOR UPDATE OF a`,
        [activityId],
      );
      const activity = activities[0];
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      const status = this.status(activity, now);
      if (status !== 'RUNNING' && status !== 'PAUSED')
        throw new Error('DRAW_NOT_ACTIVE');
      await manager.query(
        `UPDATE activity_version
         SET draw_ends_at=$2,ends_at=GREATEST(ends_at,$2)
         WHERE id=$1`,
        [activity.published_version_id, now],
      );
      await manager.query(`UPDATE activity SET paused_at=NULL WHERE id=$1`, [
        activityId,
      ]);
      await manager.query(
        `INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id) VALUES ($1,'ADMIN',$2,'DRAW_ENDED','activity',$3)`,
        [randomUUID(), adminId, activityId],
      );
    });
  }

  async pause(activityId: string, adminId: string): Promise<void> {
    await this.setPaused(activityId, adminId, true);
  }

  async resume(activityId: string, adminId: string): Promise<void> {
    await this.setPaused(activityId, adminId, false);
  }

  private async setPaused(
    activityId: string,
    adminId: string,
    paused: boolean,
  ): Promise<void> {
    const now = this.now();
    await this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<LifecycleRow[]>(
        `SELECT a.published_version_id,a.paused_at,v.starts_at,v.draw_ends_at,v.ends_at
         FROM activity a
         LEFT JOIN activity_version v ON v.id=a.published_version_id
         WHERE a.id=$1
         FOR UPDATE OF a`,
        [activityId],
      );
      const activity = activities[0];
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      const status = this.status(activity, now);
      if (paused && status === 'PAUSED')
        throw new Error('ACTIVITY_ALREADY_PAUSED');
      if (!paused && status === 'RUNNING')
        throw new Error('ACTIVITY_NOT_PAUSED');
      if (paused ? status !== 'RUNNING' : status !== 'PAUSED')
        throw new Error('ACTIVITY_NOT_RUNNING');

      await manager.query(`UPDATE activity SET paused_at=$2 WHERE id=$1`, [
        activityId,
        paused ? now : null,
      ]);
      await manager.query(
        `INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id) VALUES ($1,'ADMIN',$2,$3,'activity',$4)`,
        [
          randomUUID(),
          adminId,
          paused ? 'ACTIVITY_PAUSED' : 'ACTIVITY_RESUMED',
          activityId,
        ],
      );
    });
  }

  private now(): Date {
    return this.clock.now();
  }

  private status(activity: LifecycleRow, now: Date): ActivityStatus {
    if (!activity.starts_at || !activity.draw_ends_at || !activity.ends_at)
      return 'DRAFT';
    return deriveActivityStatus(
      {
        publishedVersionId: activity.published_version_id,
        startsAt: new Date(activity.starts_at),
        drawEndsAt: new Date(activity.draw_ends_at),
        endsAt: new Date(activity.ends_at),
        pausedAt: activity.paused_at ? new Date(activity.paused_at) : null,
      },
      now,
    );
  }
}
