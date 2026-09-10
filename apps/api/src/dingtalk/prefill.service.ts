import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ParticipantsService } from '../participants/participants.service.js';
import { RuntimeService } from '../runtime/runtime.service.js';

type FormConfig = { formUrl: string; prefillField: string };

@Injectable()
export class DingTalkPrefillService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService,
    @Inject(RuntimeService) private readonly runtime: RuntimeService,
  ) {}

  async createFormUrl(
    userId: string,
    activityCode: string,
  ): Promise<{ url: string }> {
    const state = await this.runtime.get(userId, activityCode, 'direct', false);
    if (state.nextStep !== 'FORM')
      throw new Error(`FORM_NOT_AVAILABLE:${state.nextStep}`);
    const rows = await this.dataSource.query<
      { id: string; config: FormConfig }[]
    >(
      `SELECT a.id, v.config FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.code=$1`,
      [activityCode],
    );
    const activity = rows[0];
    if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
    const participation = await this.participants.getOrCreate(
      userId,
      activity.id,
    );
    const url = new URL(activity.config.formUrl);
    url.searchParams.set(activity.config.prefillField, participation.id);
    return { url: url.toString() };
  }
}
