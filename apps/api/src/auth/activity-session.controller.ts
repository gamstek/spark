import { randomUUID } from 'node:crypto';

import {
  Controller,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DataSource, IsNull, Not } from 'typeorm';

import { Activity, UserAccount } from '../../database/entities/index.js';
import { OAuthStateService } from '../wechat/oauth-state.service.js';
import {
  ACTIVITY_IDENTITY_MODE,
  type ActivityIdentityMode,
} from './activity-identity-mode.js';
import { cookieNames } from './session.guard.js';
import { SessionService } from './session.service.js';

function secureSuffix(): string {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

@Controller('activity/:code/session')
export class ActivitySessionController {
  private readonly logger = new Logger(ActivitySessionController.name);

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(OAuthStateService) private readonly states: OAuthStateService,
    @Inject(ACTIVITY_IDENTITY_MODE)
    private readonly identityMode: ActivityIdentityMode,
  ) {}

  @Post()
  async create(
    @Param('code') code: string,
    @Query('returnPath') returnPath: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const destination = returnPath ?? `/activity/${code}`;
    this.states.validateReturnPath(destination);
    const activityPath = `/activity/${encodeURIComponent(code)}`;
    if (
      destination !== activityPath &&
      !destination.startsWith(`${activityPath}?`) &&
      !destination.startsWith(`${activityPath}/`)
    ) {
      throw new Error('RETURN_PATH_INVALID');
    }
    const activity = await this.dataSource.getRepository(Activity).findOne({
      select: { id: true },
      where: { code, publishedVersionId: Not(IsNull()) },
    });
    if (!activity) throw new NotFoundException('ACTIVITY_NOT_FOUND');

    if (this.identityMode === 'wechat') {
      return reply.send({
        authenticated: false,
        redirectUrl: `/api/wechat/oauth/start?returnPath=${encodeURIComponent(destination)}`,
      });
    }

    const session = await this.dataSource.transaction(async (manager) => {
      const userId = randomUUID();
      await manager.getRepository(UserAccount).insert({ id: userId });
      return this.sessions.create('ACTIVITY', userId, manager);
    });
    reply.header(
      'Set-Cookie',
      `${cookieNames.ACTIVITY}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secureSuffix()}`,
    );
    this.logger.log({
      event: 'activity.session.anonymous_created',
      requestId: request.id,
      activityCode: code,
    });
    return reply.send({ authenticated: true });
  }
}
