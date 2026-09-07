import { Injectable } from '@nestjs/common';

interface GatewayOptions {
  appId?: string;
  appSecret?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

@Injectable()
export class WechatGateway {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GatewayOptions = {}) {
    this.appId = options.appId ?? process.env.WECHAT_APP_ID ?? '';
    this.appSecret = options.appSecret ?? process.env.WECHAT_APP_SECRET ?? '';
    this.fetchImplementation = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  private async requestJson<T>(url: URL, init?: RequestInit): Promise<T> {
    try {
      const response = await this.fetchImplementation(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const body = await response.json() as T & { errcode?: number };
      if (body.errcode) throw new Error(`WECHAT_${body.errcode}`);
      return body;
    } catch (error) {
      throw new Error('WECHAT_REQUEST_FAILED', { cause: error });
    }
  }

  async exchangeCode(code: string): Promise<{ openid: string }> {
    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    url.search = new URLSearchParams({ appid: this.appId, secret: this.appSecret, code, grant_type: 'authorization_code' }).toString();
    const body = await this.requestJson<{ openid: string }>(url);
    if (!body.openid) throw new Error('WECHAT_RESPONSE_INVALID');
    return { openid: body.openid };
  }

  async fetchStableAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
    const body = await this.requestJson<{ access_token: string; expires_in: number }>(
      new URL('https://api.weixin.qq.com/cgi-bin/stable_token'),
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_type: 'client_credential', appid: this.appId, secret: this.appSecret, force_refresh: false }) },
    );
    return { accessToken: body.access_token, expiresIn: body.expires_in };
  }

  async isSubscribed(openid: string, accessToken: string): Promise<boolean> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/user/info');
    url.search = new URLSearchParams({ access_token: accessToken, openid, lang: 'zh_CN' }).toString();
    const body = await this.requestJson<{ subscribe: number }>(url);
    return body.subscribe === 1;
  }
}
