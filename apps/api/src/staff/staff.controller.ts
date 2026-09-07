import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { RequireSession, SessionGuard } from '../auth/session.guard.js';

@Controller('staff')
@RequireSession('STAFF')
@UseGuards(SessionGuard)
export class StaffController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Get('activities')
  async listActivities(@Req() request: { session: { subjectId: string } }) {
    return this.dataSource.query<{ id: string; code: string; name: string }[]>(
      `SELECT activity.id, activity.code, activity.name FROM activity
       JOIN staff_activity_permission permission ON permission.activity_id=activity.id
       WHERE permission.staff_account_id=$1 ORDER BY activity.name`, [request.session.subjectId],
    );
  }
}
