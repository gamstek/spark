import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { ReportsService } from './reports.service.js';
@Controller('admin/activities')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}
  @Get(':id/report') get(@Param('id') id: string) {
    return this.reports.get(id);
  }
  @Get(':id/redemptions') listRedemptions(@Param('id') id: string) {
    return this.reports.listRedemptions(id);
  }
}
