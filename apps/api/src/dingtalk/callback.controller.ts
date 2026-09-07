import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import {
  DingTalkCallbackService,
  type CallbackInput,
} from './callback.service.js';
import { DingTalkPrefillService } from './prefill.service.js';

type ActivityRequest = { session: { subjectId: string } };

@Controller()
export class DingTalkCallbackController {
  constructor(
    @Inject(DingTalkCallbackService)
    private readonly callbacks: DingTalkCallbackService,
    @Inject(DingTalkPrefillService)
    private readonly prefill: DingTalkPrefillService,
  ) {}

  @Post('integrations/dingtalk/form-submissions')
  accept(
    @Body() input: CallbackInput,
    @Headers('authorization') authorization?: string,
  ) {
    const secret = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    return this.callbacks.accept(input, secret);
  }

  @Post('activity/:code/form-link')
  @RequireSession('ACTIVITY')
  @UseGuards(SessionGuard)
  createFormLink(@Param('code') code: string, @Req() request: ActivityRequest) {
    return this.prefill.createFormUrl(request.session.subjectId, code);
  }
}
