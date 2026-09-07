import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { RedemptionsService } from './redemptions.service.js';

type SessionRequest = { session: { subjectId: string } };

@Controller()
export class RedemptionsController {
  constructor(
    @Inject(RedemptionsService)
    private readonly redemptions: RedemptionsService,
  ) {}

  @Get('activity/:code/prize-code')
  @RequireSession('ACTIVITY')
  @UseGuards(SessionGuard)
  getOwnCode(@Param('code') code: string, @Req() request: SessionRequest) {
    return this.redemptions.getOwnCode(request.session.subjectId, code);
  }

  @Post('staff/redemptions/lookup')
  @RequireSession('STAFF')
  @UseGuards(SessionGuard)
  lookup(@Body() body: { code: string }, @Req() request: SessionRequest) {
    return this.redemptions.lookup(body.code, request.session.subjectId);
  }

  @Post('staff/redemptions/confirm')
  @RequireSession('STAFF')
  @UseGuards(SessionGuard, CsrfGuard)
  confirm(@Body() body: { code: string }, @Req() request: SessionRequest) {
    return this.redemptions.confirm(body.code, request.session.subjectId);
  }
}
