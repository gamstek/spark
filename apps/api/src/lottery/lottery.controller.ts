import { Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';

import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { LotteryService } from './lottery.service.js';

type ActivityRequest = { session: { subjectId: string } };

@Controller('activity/:code/lottery')
@RequireSession('ACTIVITY')
@UseGuards(SessionGuard)
export class LotteryController {
  constructor(@Inject(LotteryService) private readonly lottery: LotteryService) {}
  @Post()
  async draw(@Param('code') code: string, @Req() request: ActivityRequest) {
    return { win: await this.lottery.draw(request.session.subjectId, code) };
  }
}
