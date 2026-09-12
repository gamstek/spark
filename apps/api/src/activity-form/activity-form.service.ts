import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  ActivityFormSubmissionSchema,
  type ActivityFormSubmissionInput,
} from '@spark/contracts';
import { DataSource } from 'typeorm';

type ActivityRow = {
  id: string;
  template_id: string;
  template_version: number;
  starts_at: Date;
  draw_ends_at: Date;
};

@Injectable()
export class ActivityFormService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly now: () => Date = () => new Date(),
    private readonly afterSubmissionInserted: () => void = () => undefined,
  ) {}

  async submit(
    userId: string,
    activityCode: string,
    input: unknown,
  ): Promise<{ submitted: true }> {
    const parsed: ActivityFormSubmissionInput =
      ActivityFormSubmissionSchema.parse(input);
    const { privacyAccepted: _privacyAccepted, ...answers } = parsed;

    return this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<ActivityRow[]>(
        `SELECT a.id,v.template_id,v.template_version,v.starts_at,v.draw_ends_at
         FROM activity a JOIN activity_version v ON v.id=a.published_version_id
         WHERE a.code=$1`,
        [activityCode],
      );
      const activity = activities[0];
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      if (
        activity.template_id !== 'exhibition-lottery' ||
        activity.template_version !== 1
      )
        throw new Error('FORM_NOT_AVAILABLE');

      const participations = await manager.query<{ id: string }[]>(
        `INSERT INTO activity_participation (id,activity_id,user_id,lead_completed)
         VALUES ($1,$2,$3,false)
         ON CONFLICT (activity_id,user_id)
         DO UPDATE SET activity_id=EXCLUDED.activity_id
         RETURNING id`,
        [randomUUID(), activity.id, userId],
      );
      const participation = participations[0];
      if (!participation) throw new Error('PARTICIPATION_NOT_FOUND');

      const submissions = await manager.query<{ id: string }[]>(
        `SELECT id FROM activity_form_submission WHERE participation_id=$1`,
        [participation.id],
      );
      if (submissions[0]) return { submitted: true as const };

      const now = this.now();
      if (
        now < new Date(activity.starts_at) ||
        now >= new Date(activity.draw_ends_at)
      )
        throw new Error('FORM_NOT_AVAILABLE');

      await manager.query(
        `INSERT INTO activity_form_submission (id,participation_id,answers,submitted_at)
         VALUES ($1,$2,$3,$4)`,
        [randomUUID(), participation.id, answers, now],
      );
      this.afterSubmissionInserted();
      await manager.query(
        `UPDATE activity_participation
         SET lead_completed=true,lead_completed_at=$2,updated_at=$2
         WHERE id=$1`,
        [participation.id, now],
      );
      return { submitted: true as const };
    });
  }
}
