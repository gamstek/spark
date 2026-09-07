import { randomUUID } from 'node:crypto';

import { getTemplate } from '@spark/templates';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PublishService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async publish(activityId: string, expectedRevision: number, adminId: string): Promise<{ version: number; revision: number }> {
    return this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<{ revision: number; draft_version_id: string | null; published_version_id: string | null }[]>(
        `SELECT revision, draft_version_id, published_version_id FROM activity WHERE id=$1 FOR UPDATE`, [activityId],
      );
      const activity = activities[0];
      if (!activity?.draft_version_id) throw new Error('DRAFT_NOT_FOUND');
      if (activity.revision !== expectedRevision) throw new Error('VERSION_CONFLICT');
      const versions = await manager.query<{ version: number; template_id: string; template_version: number; config: unknown; starts_at: Date; draw_ends_at: Date; ends_at: Date; redeem_ends_at: Date }[]>(
        `SELECT * FROM activity_version WHERE id=$1 FOR UPDATE`, [activity.draft_version_id],
      );
      const draft = versions[0];
      if (!draft) throw new Error('DRAFT_NOT_FOUND');
      const template = getTemplate(draft.template_id, draft.template_version);
      if (!template.configSchema.safeParse(draft.config).success) throw new Error('INVALID_TEMPLATE_CONFIG');
      if (!(draft.starts_at < draft.draw_ends_at && draft.draw_ends_at <= draft.ends_at && draft.redeem_ends_at >= draft.draw_ends_at)) throw new Error('INVALID_ACTIVITY_TIME');
      const prizeCount = await manager.query<{ count: string }[]>(`SELECT count(*) FROM activity_prize WHERE activity_id=$1 AND total_stock > 0`, [activityId]);
      if (Number(prizeCount[0]?.count ?? 0) === 0) throw new Error('PRIZE_REQUIRED');
      await manager.query(
        `UPDATE activity_prize ap SET prize_name=p.name, prize_image_url=CASE WHEN m.id IS NULL THEN NULL ELSE '/media/' || m.storage_key END
         FROM prize p LEFT JOIN media_asset m ON m.id=p.image_asset_id WHERE ap.activity_id=$1 AND p.id=ap.prize_id`, [activityId],
      );
      if (activity.published_version_id) await manager.query(`UPDATE activity_version SET status='ARCHIVED' WHERE id=$1`, [activity.published_version_id]);
      await manager.query(`UPDATE activity_version SET status='PUBLISHED', published_at=now() WHERE id=$1`, [activity.draft_version_id]);
      await manager.query(`UPDATE activity SET published_version_id=draft_version_id, draft_version_id=NULL, revision=revision+1, updated_at=now() WHERE id=$1`, [activityId]);
      await manager.query(`INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id) VALUES ($1,'ADMIN',$2,'ACTIVITY_PUBLISHED','activity',$3)`, [randomUUID(), adminId, activityId]);
      return { version: draft.version, revision: expectedRevision + 1 };
    });
  }

  async endDraw(activityId: string, adminId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT id FROM activity WHERE id=$1 FOR UPDATE`, [activityId]);
      await manager.query(`UPDATE activity_version SET draw_ends_at=LEAST(draw_ends_at, now()), ends_at=GREATEST(ends_at, now()) WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`, [activityId]);
      await manager.query(`INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id) VALUES ($1,'ADMIN',$2,'DRAW_ENDED','activity',$3)`, [randomUUID(), adminId, activityId]);
    });
  }
}
