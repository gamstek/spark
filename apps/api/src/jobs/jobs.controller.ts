import { Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { JobsService } from './jobs.service.js';

@Controller('admin/jobs')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  @Get('failed')
  listFailed() { return this.jobs.listFailed(); }

  @Post(':id/retry')
  @UseGuards(CsrfGuard)
  async retry(@Param('id') id: string) {
    await this.jobs.retry(id);
    return { success: true };
  }
}
