import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { getTemplate } from '@spark/templates';
import { DataSource } from 'typeorm';
type Clock = () => Date;
type DraftPatch = { name?: string; config?: unknown };
@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly clock: Clock = () => new Date(),
  ) {}
  list() {
    return this.dataSource.query(
      `SELECT a.id,a.code,a.name,a.revision,a.published_version_id,a.draft_version_id,v.starts_at,v.draw_ends_at,v.ends_at FROM activity a LEFT JOIN activity_version v ON v.id=COALESCE(a.draft_version_id,a.published_version_id) ORDER BY a.created_at DESC`,
    );
  }
  async get(activityId: string) {
    const rows = await this.dataSource.query(
      `SELECT a.id,a.code,a.name,a.revision,a.published_version_id,a.draft_version_id,v.version,v.template_id,v.template_version,v.config,v.starts_at,v.draw_ends_at,v.ends_at,v.redeem_ends_at FROM activity a LEFT JOIN activity_version v ON v.id=COALESCE(a.draft_version_id,a.published_version_id) WHERE a.id=$1`,
      [activityId],
    );
    if (!rows[0]) throw new Error('ACTIVITY_NOT_FOUND');
    return rows[0];
  }
  async create(input: {
    code: string;
    name: string;
    templateId: string;
    templateVersion: number;
    config: unknown;
    startsAt: string;
    drawEndsAt: string;
    endsAt: string;
    redeemEndsAt: string;
  }) {
    const template = getTemplate(input.templateId, input.templateVersion);
    const config = template.configSchema.parse(input.config);
    const activityId = randomUUID(),
      versionId = randomUUID();
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO activity (id,code,name,draft_version_id) VALUES ($1,$2,$3,NULL)`,
        [activityId, input.code, input.name],
      );
      await manager.query(
        `INSERT INTO activity_version (id,activity_id,version,status,template_id,template_version,config_schema_version,config,starts_at,draw_ends_at,ends_at,redeem_ends_at) VALUES ($1,$2,1,'DRAFT',$3,$4,1,$5,$6,$7,$8,$9)`,
        [
          versionId,
          activityId,
          input.templateId,
          input.templateVersion,
          config,
          input.startsAt,
          input.drawEndsAt,
          input.endsAt,
          input.redeemEndsAt,
        ],
      );
      await manager.query(`UPDATE activity SET draft_version_id=$2 WHERE id=$1`, [
        activityId,
        versionId,
      ]);
    });
    return { id: activityId, revision: 0 };
  }
  async updateDraft(
    activityId: string,
    expectedRevision: number,
    patch: DraftPatch,
  ): Promise<{ revision: number }> {
    return this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<
        { revision: number; draft_version_id: string | null; starts_at: Date | null }[]
      >(
        `SELECT a.revision,a.draft_version_id,published.starts_at FROM activity a LEFT JOIN activity_version published ON published.id=a.published_version_id WHERE a.id=$1 FOR UPDATE OF a`,
        [activityId],
      );
      const activity = activities[0];
      if (!activity || !activity.draft_version_id) throw new Error('DRAFT_NOT_FOUND');
      if (activity.revision !== expectedRevision) throw new Error('VERSION_CONFLICT');
      if (activity.starts_at && new Date(activity.starts_at).getTime() <= this.clock().getTime())
        throw new Error('ACTIVITY_LOCKED');
      if (patch.name !== undefined)
        await manager.query(`UPDATE activity SET name=$2 WHERE id=$1`, [activityId, patch.name]);
      if (patch.config !== undefined)
        await manager.query(`UPDATE activity_version SET config=$2 WHERE id=$1`, [
          activity.draft_version_id,
          patch.config,
        ]);
      const revision = expectedRevision + 1;
      await manager.query(`UPDATE activity SET revision=$2,updated_at=now() WHERE id=$1`, [
        activityId,
        revision,
      ]);
      return { revision };
    });
  }
}
