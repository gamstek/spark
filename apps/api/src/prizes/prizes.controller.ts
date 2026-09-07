import { Body, Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { PrizesService } from './prizes.service.js';

@Controller('admin/prizes')
@RequireSession('ADMIN')
@UseGuards(SessionGuard)
export class PrizesController {
  constructor(@Inject(PrizesService) private readonly prizes: PrizesService) {}

  @Post('activity-prizes/:id/stock')
  @UseGuards(CsrfGuard)
  async addStock(
    @Param('id') id: string,
    @Body() body: { quantity: number; operationId: string },
    @Req() request: { session: { subjectId: string } },
  ) {
    await this.prizes.addStock(id, body.quantity, body.operationId, request.session.subjectId);
    return { success: true };
  }
}
