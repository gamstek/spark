import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { cookieNames, readCookie } from '../auth/session.guard.js';
import { SessionService } from '../auth/session.service.js';
import { requestOrigin } from '../common/request-origin.js';
import { DEVELOPMENT_WECHAT_OPENID } from './development-identity.js';
import { OAuthStateService } from './oauth-state.service.js';
import { WechatGateway } from './wechat.gateway.js';
import { WechatIdentityService } from './wechat-identity.service.js';

function secureSuffix(): string {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

@Controller('wechat/oauth')
export class OAuthController {
  constructor(
    @Inject(OAuthStateService) private readonly states: OAuthStateService,
    @Inject(WechatGateway) private readonly gateway: WechatGateway,
    @Inject(WechatIdentityService)
    private readonly identities: WechatIdentityService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Post('simulate')
  async simulate(@Res() reply: FastifyReply) {
    if (process.env.NODE_ENV !== 'development')
      throw new NotFoundException('NOT_FOUND');
    const openid = DEVELOPMENT_WECHAT_OPENID;
    const { userId } = await this.identities.getOrCreateUser(openid);
    await this.identities.markSubscribed(openid);
    const session = await this.sessions.create('ACTIVITY', userId);
    reply.header(
      'Set-Cookie',
      `${cookieNames.ACTIVITY}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
    );
    return reply.send({ authenticated: true });
  }

  @Get('start')
  async start(
    @Query('returnPath') returnPath: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const issued = await this.states.issue(returnPath);
    reply.header(
      'Set-Cookie',
      `spark_oauth_nonce=${issued.browserNonce}; Path=/api/wechat/oauth; HttpOnly; SameSite=Lax; Max-Age=600${secureSuffix()}`,
    );
    const callback = `${requestOrigin(request)}/api/wechat/oauth/callback`;
    const authorize = new URL(
      'https://open.weixin.qq.com/connect/oauth2/authorize',
    );
    authorize.search = new URLSearchParams({
      appid: process.env.WECHAT_APP_ID ?? '',
      redirect_uri: callback,
      response_type: 'code',
      scope: 'snsapi_base',
      state: issued.state,
    }).toString();
    return reply.redirect(`${authorize.toString()}#wechat_redirect`);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const nonce = readCookie(request.headers.cookie, 'spark_oauth_nonce');
    if (!nonce) throw new Error('OAUTH_STATE_INVALID');
    const returnPath = await this.states.consume(state, nonce);
    const { openid } = await this.gateway.exchangeCode(code);
    const { userId } = await this.identities.getOrCreateUser(openid);
    const session = await this.sessions.create('ACTIVITY', userId);
    reply.header(
      'Set-Cookie',
      `${cookieNames.ACTIVITY}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secureSuffix()}`,
    );
    return reply.redirect(returnPath);
  }
}
