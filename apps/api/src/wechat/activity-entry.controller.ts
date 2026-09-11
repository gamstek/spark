import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { cookieNames } from '../auth/session.guard.js';
import { WechatActivityEntryService } from './activity-entry.service.js';

@Controller('activity/entry')
export class ActivityEntryController {
  constructor(
    @Inject(WechatActivityEntryService)
    private readonly entries: WechatActivityEntryService,
  ) {}

  @Get()
  async enter(@Query('t') token: unknown, @Res() reply: FastifyReply) {
    const result = await this.entries.exchange(
      typeof token === 'string' ? token : '',
    );
    let path = '/activity/entry-error';
    if (result.status === 'exchanged') {
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      reply.header(
        'Set-Cookie',
        `${cookieNames.ACTIVITY}=${result.sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
      );
      path = `/activity/${encodeURIComponent(result.activityCode)}`;
    } else if (result.activityCode !== null) {
      path = `/activity/${encodeURIComponent(result.activityCode)}?entryError=invalid`;
    }
    return reply.status(302).redirect(path);
  }
}
