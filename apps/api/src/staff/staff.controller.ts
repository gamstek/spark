import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { StaffActivityPermission } from '../../database/entities/index.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';

const UUID_RE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

@Controller('staff')
@RequireSession('STAFF')
@UseGuards(SessionGuard)
export class StaffController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Get('activities')
  async listActivities(@Req() request: { session: { subjectId: string } }) {
    return this.dataSource.query<
      {
        id: string;
        code: string;
        name: string;
        startsAt: Date;
        endsAt: Date;
        rulesText: string;
      }[]
    >(
      `SELECT activity.id, activity.code, activity.name,
         version.starts_at AS "startsAt", version.ends_at AS "endsAt",
         COALESCE(version.config->>'rulesText','') AS "rulesText"
       FROM activity
       JOIN staff_activity_permission permission ON permission.activity_id=activity.id
       JOIN activity_version version ON version.id=activity.published_version_id
       WHERE permission.staff_account_id=$1 ORDER BY activity.name`,
      [request.session.subjectId],
    );
  }

  /** Read-only prize stock for one permitted activity. */
  @Get('activities/:activityId/prizes')
  async listPrizes(
    @Param('activityId') activityId: string,
    @Req() request: { session: { subjectId: string } },
  ) {
    if (!UUID_RE.test(activityId))
      throw new BadRequestException('VALIDATION_ERROR');
    const permitted = await this.dataSource
      .getRepository(StaffActivityPermission)
      .existsBy({
        staffAccountId: request.session.subjectId,
        activityId,
      });
    if (!permitted) throw new ForbiddenException('FORBIDDEN');
    return this.dataSource.query<
      {
        id: string;
        name: string;
        totalStock: number;
        awardedStock: number;
      }[]
    >(
      `SELECT ap.id,ap.prize_name AS "name",ap.total_stock AS "totalStock",ap.awarded_stock AS "awardedStock"
       FROM activity_prize ap WHERE ap.activity_id=$1 ORDER BY ap.created_at,ap.id`,
      [activityId],
    );
  }
}
