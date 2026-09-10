import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';

import { RequireSession, SessionGuard } from '../auth/session.guard.js';
import { WechatJsSdkService } from './js-sdk.service.js';

@Controller('staff/wechat')
@RequireSession('STAFF')
@UseGuards(SessionGuard)
export class WechatJsSdkController {
  constructor(
    @Inject(WechatJsSdkService)
    private readonly jsSdk: WechatJsSdkService,
  ) {}

  @Get('js-sdk-config')
  config(@Query('url') url: string) {
    return this.jsSdk.createConfig(url);
  }
}
