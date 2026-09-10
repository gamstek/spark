import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
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

  @Get('staff/redemptions/records')
  @RequireSession('STAFF')
  @UseGuards(SessionGuard)
  listRecords(
    @Query('activityId') activityId: string | undefined,
    @Req() request: SessionRequest,
  ) {
    if (
      activityId &&
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(activityId)
    )
      throw new BadRequestException('VALIDATION_ERROR');
    return this.redemptions.listRecords(
      request.session.subjectId,
      activityId ?? null,
    );
  }

  @Post('staff/redemptions/confirm')
  @RequireSession('STAFF')
  @UseGuards(SessionGuard, CsrfGuard)
  confirm(@Body() body: { code: string }, @Req() request: SessionRequest) {
    return this.redemptions.confirm(body.code, request.session.subjectId);
  }
}
