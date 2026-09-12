import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { ActivityFormService } from './activity-form.service.js';

type ActivityRequest = FastifyRequest & { session: { subjectId: string } };

@Controller('activity/:code/form-submissions')
@RequireSession('ACTIVITY')
@UseGuards(SessionGuard)
export class ActivityFormController {
  constructor(
    @Inject(ActivityFormService) private readonly forms: ActivityFormService,
  ) {}

  @Post()
  @UseGuards(CsrfGuard)
  submit(
    @Param('code') code: string,
    @Body() input: unknown,
    @Req() request: ActivityRequest,
  ) {
    return this.forms.submit(request.session.subjectId, code, input);
  }
}
