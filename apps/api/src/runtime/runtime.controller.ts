import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { RuntimeService } from './runtime.service.js';

type ActivitySessionRequest = {
  session: { subjectId: string; csrfToken: string };
};

@Controller('activity/:code/runtime')
@RequireSession('ACTIVITY')
@UseGuards(SessionGuard)
export class RuntimeController {
  constructor(
    @Inject(RuntimeService) private readonly runtime: RuntimeService,
  ) {}

  @Get()
  get(
    @Param('code') code: string,
    @Query('channel') channel: string | undefined,
    @Req() request: ActivitySessionRequest,
  ) {
    return this.runtime
      .get(request.session.subjectId, code, channel)
      .then((result) => ({ ...result, csrfToken: request.session.csrfToken }));
  }
}

/** Read-only display data for the participant H5 (name, dates, rules, prizes). */
@Controller('activity/:code')
@RequireSession('ACTIVITY')
@UseGuards(SessionGuard)
export class ActivityInfoController {
  constructor(
    @Inject(RuntimeService) private readonly runtime: RuntimeService,
  ) {}

  @Get('info')
  getInfo(@Param('code') code: string) {
    return this.runtime.getInfo(code);
  }
}
