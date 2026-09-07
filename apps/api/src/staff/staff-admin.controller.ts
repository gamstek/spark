import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
    body: {
      username: string;
      displayName: string;
      password: string;
      activityIds: string[];
    },
    @Req() request: { session: { subjectId: string } },
  ) {
    return this.staff.create(body, request.session.subjectId);
  }
  @Patch(':id')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Body() body: { displayName: string; activityIds: string[] },
    @Req() request: { session: { subjectId: string } },
  ) {
    await this.staff.update(id, body, request.session.subjectId);
    return { success: true };
  }
  @Post(':id/password')
  @UseGuards(CsrfGuard)
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @Req() request: { session: { subjectId: string } },
  ) {
    await this.staff.resetPassword(
      id,
      body.password,
      request.session.subjectId,
    );
    return { success: true };
  }
  @Post(':id/status')
  @UseGuards(CsrfGuard)
  async status(
    @Param('id') id: string,
    @Body() body: { disabled: boolean },
    @Req() request: { session: { subjectId: string } },
  ) {
    await this.staff.setDisabled(id, body.disabled, request.session.subjectId);
    return { success: true };
  }
}
