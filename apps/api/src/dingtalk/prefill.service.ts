import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ParticipantsService } from '../participants/participants.service.js';

type FormConfig = { formUrl: string; prefillField: string };

@Injectable()
export class DingTalkPrefillService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Inject(ParticipantsService) private readonly participants: ParticipantsService) {}

  async createFormUrl(userId: string, activityCode: string): Promise<{ url: string }> {
    const rows = await this.dataSource.query<{ id: string; config: FormConfig }[]>(
      `SELECT a.id, v.config FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.code=$1`, [activityCode],
    );
    const activity = rows[0];
    if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
    const participation = await this.participants.getOrCreate(userId, activity.id);
    const url = new URL(activity.config.formUrl);
    if (!url.searchParams.has(activity.config.prefillField)) throw new Error('FORM_PREFILL_SAMPLE_INVALID');
    url.searchParams.set(activity.config.prefillField, participation.id);
    return { url: url.toString() };
  }
}
