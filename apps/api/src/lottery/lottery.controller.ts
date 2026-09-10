import {
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { requestOrigin } from '../common/request-origin.js';
import { LotteryService } from './lottery.service.js';

type ActivityRequest = FastifyRequest & { session: { subjectId: string } };

@Controller('activity/:code/lottery')
@RequireSession('ACTIVITY')
@UseGuards(SessionGuard)
export class LotteryController {
  constructor(
    @Inject(LotteryService) private readonly lottery: LotteryService,
  ) {}
  @Post()
  @UseGuards(CsrfGuard)
  async draw(@Param('code') code: string, @Req() request: ActivityRequest) {
    return {
      win: await this.lottery.draw(
        request.session.subjectId,
        code,
        requestOrigin(request),
      ),
    };
  }
}
