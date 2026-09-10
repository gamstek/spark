import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { WechatTokenService } from './token.service.js';
import type { WechatGateway } from './wechat.gateway.js';

export type WechatJsSdkConfig = {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
};

@Injectable()
export class WechatJsSdkService {
  private ticket: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly tokens: WechatTokenService,
    private readonly gateway: WechatGateway,
    private readonly now: () => number = Date.now,
    private readonly nonce: () => string = () =>
      randomBytes(16).toString('hex'),
    private readonly appId: string = process.env.WECHAT_APP_ID ?? '',
  ) {}

  async createConfig(pageUrl: string): Promise<WechatJsSdkConfig> {
    const url = new URL(pageUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new Error('VALIDATION_ERROR');
    url.hash = '';

    const ticket = await this.getTicket();
    const timestamp = Math.floor(this.now() / 1000);
    const nonceStr = this.nonce();
    const source = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url.toString()}`;
    return {
      appId: this.appId,
      timestamp,
      nonceStr,
      signature: createHash('sha1').update(source).digest('hex'),
    };
  }

  private async getTicket(): Promise<string> {
    if (this.ticket && this.ticket.expiresAt > this.now() + 60_000)
      return this.ticket.value;
    const accessToken = await this.tokens.getAccessToken();
    const fresh = await this.gateway.fetchJsApiTicket(accessToken);
    this.ticket = {
      value: fresh.ticket,
      expiresAt: this.now() + Math.max(60, fresh.expiresIn - 120) * 1000,
    };
    return fresh.ticket;
  }
}
