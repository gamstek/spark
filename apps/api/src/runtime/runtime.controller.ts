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
    @Req() request: { session: { subjectId: string } },
  ) {
    return this.runtime.get(request.session.subjectId, code, channel);
  }
}
