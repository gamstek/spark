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
      `SELECT p.id,p.user_id,p.created_at,p.lead_completed,p.lead_completed_at,s.answers,
         l.prize_name,CASE WHEN r.status='WAIT_REDEEM' AND r.redeem_end_at<=now() THEN 'EXPIRED' ELSE r.status END AS redemption_status,
         (SELECT cv.channel_code FROM channel_visit cv WHERE cv.activity_id=p.activity_id AND cv.user_id=p.user_id ORDER BY cv.visited_at,cv.id LIMIT 1) AS channel_code
       FROM activity_participation p LEFT JOIN activity_form_submission s ON s.participation_id=p.id
       LEFT JOIN lottery_record l ON l.participation_id=p.id LEFT JOIN redemption r ON r.lottery_record_id=l.id
       WHERE p.activity_id=$1 ORDER BY p.created_at DESC LIMIT 500`,
      [activityId],
    );
  }
}
