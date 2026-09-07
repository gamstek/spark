import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { StaffService } from './staff.service.js';

@Controller('admin/staff')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class StaffAdminController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}
  @Get() list() {
    return this.staff.list();
  }
  @Post()
  @UseGuards(CsrfGuard)
  create(
    @Body()
    body: { username: string; displayName: string; password: string; activityIds: string[] },
    @Req() request: { session: { subjectId: string } },
  ) {
    return this.staff.create(body, request.session.subjectId);
  }
}
