import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { getTemplate } from '@spark/templates';
import { DataSource } from 'typeorm';
type Clock = () => Date;
type DraftPatch = {
  name?: string;
  config?: unknown;
  startsAt?: string;
  drawEndsAt?: string;
  endsAt?: string;
  redeemEndsAt?: string;
};

function parseTimeline(input: {
  startsAt: string;
  drawEndsAt: string;
  endsAt: string;
  redeemEndsAt: string;
}) {
  const dates = [
    input.startsAt,
    input.drawEndsAt,
    input.endsAt,
    input.redeemEndsAt,
  ].map((value) => new Date(value));
  if (dates.some((value) => Number.isNaN(value.getTime())))
    throw new Error('INVALID_ACTIVITY_TIME');
  const [startsAt, drawEndsAt, endsAt, redeemEndsAt] = dates as [
    Date,
    Date,
    Date,
    Date,
  ];
  if (!(
    startsAt < drawEndsAt &&
    drawEndsAt <= endsAt &&
    endsAt <= redeemEndsAt
  )) {
    throw new Error('INVALID_ACTIVITY_TIME');
  }
  return { startsAt, drawEndsAt, endsAt, redeemEndsAt };
}
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
    const timeline = parseTimeline(input);
    const name = input.name.trim();
    if (!name || name.length > 120) throw new Error('INVALID_ACTIVITY');
    const activityId = randomUUID(),
      versionId = randomUUID(),
      code = randomBytes(5).toString('hex');
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO activity (id,code,name,draft_version_id) VALUES ($1,$2,$3,NULL)`,
        [activityId, code, name],
      );
      await manager.query(
        `INSERT INTO activity_version (id,activity_id,version,status,template_id,template_version,config_schema_version,config,starts_at,draw_ends_at,ends_at,redeem_ends_at,activity_name) VALUES ($1,$2,1,'DRAFT',$3,$4,1,$5,$6,$7,$8,$9,$10)`,
        [
          versionId,
          activityId,
          input.templateId,
          input.templateVersion,
          config,
          timeline.startsAt,
          timeline.drawEndsAt,
          timeline.endsAt,
          timeline.redeemEndsAt,
          name,
        ],
      );
      await manager.query(
        `UPDATE activity SET draft_version_id=$2 WHERE id=$1`,
        [activityId, versionId],
      );
    });
    return { id: activityId, code, revision: 0 };
  }
  async updateDraft(
    activityId: string,
    expectedRevision: number,
    patch: DraftPatch,
  ): Promise<{ revision: number }> {
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
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      if (activity.revision !== expectedRevision)
        throw new Error('VERSION_CONFLICT');
      if (
        activity.starts_at &&
        new Date(activity.starts_at).getTime() <= this.clock().getTime()
      )
        throw new Error('ACTIVITY_LOCKED');
      let draftVersionId = activity.draft_version_id;
      if (!draftVersionId && activity.published_version_id) {
        draftVersionId = randomUUID();
        await manager.query(
          `INSERT INTO activity_version (id,activity_id,version,status,template_id,template_version,config_schema_version,config,starts_at,draw_ends_at,ends_at,redeem_ends_at,activity_name)
           SELECT $1,activity_id,version+1,'DRAFT',template_id,template_version,config_schema_version,config,starts_at,draw_ends_at,ends_at,redeem_ends_at,activity_name FROM activity_version WHERE id=$2`,
          [draftVersionId, activity.published_version_id],
        );
        await manager.query(
          `UPDATE activity SET draft_version_id=$2 WHERE id=$1`,
          [activityId, draftVersionId],
        );
      }
      if (!draftVersionId) throw new Error('DRAFT_NOT_FOUND');
      if (patch.name !== undefined)
        await manager.query(`UPDATE activity SET name=$2 WHERE id=$1`, [
          activityId,
          patch.name.trim(),
        ]);
      const versions = await manager.query<
        {
          template_id: string;
          template_version: number;
          config: unknown;
          starts_at: Date;
          draw_ends_at: Date;
          ends_at: Date;
          redeem_ends_at: Date;
        }[]
      >(`SELECT * FROM activity_version WHERE id=$1`, [draftVersionId]);
      const version = versions[0]!;
      const config =
        patch.config === undefined
          ? version.config
          : getTemplate(
              version.template_id,
              version.template_version,
            ).configSchema.parse(patch.config);
      const timeline = parseTimeline({
        startsAt: patch.startsAt ?? version.starts_at.toISOString(),
        drawEndsAt: patch.drawEndsAt ?? version.draw_ends_at.toISOString(),
        endsAt: patch.endsAt ?? version.ends_at.toISOString(),
        redeemEndsAt:
          patch.redeemEndsAt ?? version.redeem_ends_at.toISOString(),
      });
      await manager.query(
        `UPDATE activity_version SET config=$2,starts_at=$3,draw_ends_at=$4,ends_at=$5,redeem_ends_at=$6 WHERE id=$1`,
        [
          draftVersionId,
          config,
          timeline.startsAt,
          timeline.drawEndsAt,
          timeline.endsAt,
          timeline.redeemEndsAt,
        ],
      );
      if (patch.name !== undefined) {
        await manager.query(
          `UPDATE activity_version SET activity_name=$2 WHERE id=$1`,
          [draftVersionId, patch.name.trim()],
        );
      }
      const revision = expectedRevision + 1;
      await manager.query(
        `UPDATE activity SET revision=$2,updated_at=now() WHERE id=$1`,
        [activityId, revision],
      );
      return { revision };
    });
  }
}
