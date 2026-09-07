import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';

@Controller('admin/activities/:activityId/participants')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class ParticipantsAdminController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}
  @Get()
  list(@Param('activityId') activityId: string) {
    return this.dataSource.query(
      `SELECT p.id,p.user_id,p.lead_completed,p.lead_completed_at,s.fields FROM activity_participation p LEFT JOIN dingtalk_form_submission s ON s.id=p.adopted_submission_id WHERE p.activity_id=$1 ORDER BY p.created_at DESC LIMIT 200`,
      [activityId],
    );
  }
}
