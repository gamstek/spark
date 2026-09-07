import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Clock = () => Date;
type DraftPatch = { name?: string; config?: unknown };

@Injectable()
export class ActivitiesService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, private readonly clock: Clock = () => new Date()) {}

  async updateDraft(activityId: string, expectedRevision: number, patch: DraftPatch): Promise<{ revision: number }> {
    return this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<{ revision: number; draft_version_id: string | null; starts_at: Date | null }[]>(
        `SELECT a.revision, a.draft_version_id, published.starts_at FROM activity a
         LEFT JOIN activity_version published ON published.id=a.published_version_id WHERE a.id=$1 FOR UPDATE OF a`, [activityId],
      );
      const activity = activities[0];
      if (!activity || !activity.draft_version_id) throw new Error('DRAFT_NOT_FOUND');
      if (activity.revision !== expectedRevision) throw new Error('VERSION_CONFLICT');
      if (activity.starts_at && new Date(activity.starts_at).getTime() <= this.clock().getTime()) throw new Error('ACTIVITY_LOCKED');
      if (patch.name !== undefined) await manager.query(`UPDATE activity SET name=$2 WHERE id=$1`, [activityId, patch.name]);
      if (patch.config !== undefined) await manager.query(`UPDATE activity_version SET config=$2 WHERE id=$1`, [activity.draft_version_id, patch.config]);
      const revision = expectedRevision + 1;
      await manager.query(`UPDATE activity SET revision=$2, updated_at=now() WHERE id=$1`, [activityId, revision]);
      return { revision };
    });
  }
}
