import { Body, Controller, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { ActivitiesService } from './activities.service.js';
import { PublishService } from './publish.service.js';

type AdminRequest = { session: { subjectId: string } };

@Controller('admin/activities')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class ActivitiesController {
  constructor(
    @Inject(ActivitiesService) private readonly activities: ActivitiesService,
    @Inject(PublishService) private readonly publishing: PublishService,
  ) {}

  @Patch(':id/draft')
  @UseGuards(CsrfGuard)
  updateDraft(@Param('id') id: string, @Body() body: { expectedRevision: number; name?: string; config?: unknown }) {
    return this.activities.updateDraft(id, body.expectedRevision, { name: body.name, config: body.config });
  }

  @Post(':id/publish')
  @UseGuards(CsrfGuard)
  publish(@Param('id') id: string, @Body() body: { expectedRevision: number }, @Req() request: AdminRequest) {
    return this.publishing.publish(id, body.expectedRevision, request.session.subjectId);
  }

  @Post(':id/end-draw')
  @UseGuards(CsrfGuard)
  async endDraw(@Param('id') id: string, @Req() request: AdminRequest) {
    await this.publishing.endDraw(id, request.session.subjectId);
    return { success: true };
  }
}
