import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { describe, expect, it, vi } from 'vitest';
import { createHttpAdapter, serializeHttpRequest } from './http-adapter.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ActivityEntryController } from './wechat/activity-entry.controller.js';
import { WechatActivityEntryService } from './wechat/activity-entry.service.js';
import { WechatCallbackController } from './wechat/callback.controller.js';
import { WechatCallbackReplayService } from './wechat/callback-replay.service.js';
import { WechatIdentityService } from './wechat/wechat-identity.service.js';

describe('HTTP XML boundary', () => {
  it('serves signed callback XML with HTTP 200 and entry redirects under the API prefix', async () => {
    vi.stubEnv('WECHAT_CALLBACK_TOKEN', 'callback-secret');
    vi.setSystemTime(1_789_123_456_000);
    const entries = {
      issue: vi.fn().mockResolvedValue({
        status: 'issued',
        activityCode: 'expo',
        url: 'https://spark.example/api/activity/entry?t=opaque-token',
      }),
      exchange: vi.fn().mockResolvedValue({
        status: 'exchanged',
        activityCode: 'expo/a',
        sessionToken: 'session-token',
      }),
    };
    @Module({
      controllers: [WechatCallbackController, ActivityEntryController],
      providers: [
        { provide: WechatActivityEntryService, useValue: entries },
        {
          provide: WechatIdentityService,
          useValue: { applySubscriptionEvent: vi.fn() },
        },
        {
          provide: WechatCallbackReplayService,
          useValue: {
            execute: (
              _input: unknown,
              work: (manager: unknown, signal: AbortSignal) => unknown,
            ) => work({}, new AbortController().signal),
          },
        },
      ],
    })
    class HttpTestModule {}
    const app = await NestFactory.create<NestFastifyApplication>(
      HttpTestModule,
      createHttpAdapter(),
      { logger: false },
    );
    try {
      app.setGlobalPrefix('api');
      app.useGlobalFilters(new ApiExceptionFilter());
      await app.init();
      const signature = createHash('sha1')
        .update('1789123456callback-secretnonce-value')
        .digest('hex');
      const query = `signature=${signature}&timestamp=1789123456&nonce=nonce-value`;
      const verified = await app.inject({
        method: 'GET',
        url: `/api/wechat/callback?${query}&echostr=000%3Cecho`,
      });
      expect(verified.statusCode).toBe(200);
      expect(verified.headers['content-type']).toBe(
        'text/plain; charset=utf-8',
      );
      expect(verified.body).toBe('000<echo');
      const received = await app.inject({
        method: 'POST',
        url: `/api/wechat/callback?${query}`,
        headers: { 'content-type': 'text/xml' },
        payload:
          '<xml><ToUserName>account</ToUserName><FromUserName>openid</FromUserName><CreateTime>1789123456</CreateTime><MsgType>event</MsgType><Event>subscribe</Event></xml>',
      });
      expect(received.statusCode).toBe(200);
      expect(received.headers['content-type']).toBe('text/xml; charset=utf-8');
      expect(received.body).toContain(
        'https://spark.example/api/activity/entry?t=opaque-token',
      );
      for (const [type, fields, issues] of [
        [
          'event',
          '<Event>subscribe</Event><EventKey>qrscene_123</EventKey><Ticket><![CDATA[private-ticket]]></Ticket>',
          true,
        ],
        [
          'text',
          '<Content><![CDATA[Hello <Event>subscribe</Event>]]></Content><MsgId>1234567890123456</MsgId>',
          false,
        ],
        [
          'event',
          '<Event>SCAN</Event><EventKey>123</EventKey><Ticket><![CDATA[private-ticket]]></Ticket>',
          false,
        ],
      ] as const) {
        entries.issue.mockClear();
        const realistic = await app.inject({
          method: 'POST',
          url: `/api/wechat/callback?${query}`,
          headers: { 'content-type': 'application/xml' },
          payload: `<xml><ToUserName>account</ToUserName><FromUserName>openid</FromUserName><CreateTime>1789123456</CreateTime><MsgType>${type}</MsgType>${fields}</xml>`,
        });
        expect(realistic.statusCode).toBe(200);
        if (issues) {
          expect(realistic.headers['content-type']).toBe(
            'text/xml; charset=utf-8',
          );
          expect(realistic.body).toContain(
            'https://spark.example/api/activity/entry?t=opaque-token',
          );
          expect(entries.issue).toHaveBeenCalledWith(
            'openid',
            new Date(1_789_123_456_000),
            expect.anything(),
            expect.any(AbortSignal),
          );
        } else {
          expect(realistic.headers['content-type']).toBe(
            'text/plain; charset=utf-8',
          );
          expect(realistic.body).toBe('success');
          expect(entries.issue).not.toHaveBeenCalled();
        }
      }
      const denied = await app.inject({
        method: 'POST',
        url: '/api/wechat/callback',
        headers: { 'content-type': 'text/xml' },
        payload: '<xml>invalid</xml>',
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json().code).toBe('WECHAT_SIGNATURE_INVALID');
      const redirected = await app.inject({
        method: 'GET',
        url: '/api/activity/entry?t=opaque-token',
      });
      expect(redirected.statusCode).toBe(302);
      expect(redirected.headers.location).toBe('/activity/expo%2Fa');
      expect(redirected.headers['set-cookie']).toBe(
        'spark_activity=session-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
      );
    } finally {
      await app.close();
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it.each(['text/xml', 'application/xml; charset=utf-8'])(
    'parses %s as a string and enforces the 64 KiB byte limit',
    async (contentType) => {
      const adapter = createHttpAdapter();
      const server = adapter.getInstance();
      server.post('/callback', (request) => ({
        type: typeof request.body,
        body: request.body,
      }));
      try {
        const accepted = await server.inject({
          method: 'POST',
          url: '/callback',
          headers: { 'content-type': contentType },
          payload: '<xml>你好</xml>',
        });
        expect(accepted.statusCode).toBe(200);
        expect(accepted.json()).toEqual({
          type: 'string',
          body: '<xml>你好</xml>',
        });
        const boundary = await server.inject({
          method: 'POST',
          url: '/callback',
          headers: { 'content-type': contentType },
          payload: 'a'.repeat(64 * 1024),
        });
        expect(boundary.statusCode).toBe(200);
        const oversized = await server.inject({
          method: 'POST',
          url: '/callback',
          headers: { 'content-type': contentType },
          payload: '你'.repeat(22 * 1024),
        });
        expect(oversized.statusCode).toBe(413);
      } finally {
        await server.close();
      }
    },
  );

  it('omits query secrets, headers, and body from request logs', () => {
    const logged = serializeHttpRequest({
      method: 'GET',
      url: '/api/activity/entry?t=secret-token',
      headers: { cookie: 'secret-cookie' },
      body: '<xml>private-openid</xml>',
    });
    expect(logged).toEqual({ method: 'GET', url: '/api/activity/entry' });
    expect(
      serializeHttpRequest({
        method: 'POST',
        url: '/api/wechat/callback?signature=secret&nonce=secret',
      }),
    ).toEqual({ method: 'POST', url: '/api/wechat/callback' });
  });
});
