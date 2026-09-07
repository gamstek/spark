import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ParticipantsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async getOrCreate(userId: string, activityId: string): Promise<{ id: string; userId: string; activityId: string; leadCompleted: boolean }> {
    const proposedId = randomUUID();
    type ParticipationRow = { id: string; user_id: string; activity_id: string; lead_completed: boolean };
    const result = await this.dataSource.query<ParticipationRow[] | [ParticipationRow[], number]>(
      `INSERT INTO activity_participation (id, activity_id, user_id, lead_completed) VALUES ($1,$2,$3,false)
       ON CONFLICT (activity_id, user_id) DO UPDATE SET updated_at=activity_participation.updated_at
       RETURNING id, user_id, activity_id, lead_completed`, [proposedId, activityId, userId],
    );
    const first = result[0];
    const row = Array.isArray(first) ? first[0] : first;
    if (!row) throw new Error('PARTICIPATION_CREATE_FAILED');
    return { id: row.id, userId: row.user_id, activityId: row.activity_id, leadCompleted: row.lead_completed };
  }
}
