import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WechatCallbackController } from './callback.controller.js';

const signed = {
  timestamp: '1789123456',
  nonce: 'nonce-value',
  signature: createHash('sha1')
    .update('1789123456callback-secretnonce-value')
    .digest('hex'),
};

function xml(event: string, eventKey = '', msgType = 'event') {
  return `<xml><ToUserName><![CDATA[official-account]]></ToUserName><FromUserName><![CDATA[private-openid]]></FromUserName><CreateTime>1789123456</CreateTime><MsgType>${msgType}</MsgType><Event>${event}</Event><EventKey>${eventKey}</EventKey></xml>`;
}

function setup() {
  const entries = {
    issue: vi.fn().mockResolvedValue({
      status: 'issued',
      url: 'https://spark.example/api/activity/entry?t=private-token',
      activityCode: 'expo',
    }),
  };
  const identities = { markUnsubscribed: vi.fn().mockResolvedValue(undefined) };
  const reply = {
    header: vi.fn().mockReturnThis(),
    send: vi.fn((body: string) => body),
  };
  const controller = new WechatCallbackController(
    entries as never,
    identities as never,
  );
  const post = (body: unknown, query: unknown = signed) =>
    controller.callback(
      query as never,
      body,
      { id: 'request-1' } as never,
      reply as never,
    );
  return { controller, entries, identities, reply, post };
}

describe('WechatCallbackController', () => {
  it.each([
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
  ])(
    'handles realistic %s messages with extra scalar fields: %s',
    async (type, fields, issues) => {
      const logs = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const { entries, reply, post } = setup();
      const body = await post(
        `<xml><ToUserName>official-account</ToUserName><FromUserName>private-openid</FromUserName><CreateTime>1789123456</CreateTime><MsgType>${type}</MsgType>${fields}</xml>`,
      );
      if (issues) {
        expect(entries.issue).toHaveBeenCalledExactlyOnceWith('private-openid');
        expect(body).toContain(
          'https://spark.example/api/activity/entry?t=private-token',
        );
        expect(reply.header).toHaveBeenCalledWith(
          'Content-Type',
          'text/xml; charset=utf-8',
        );
      } else {
        expect(entries.issue).not.toHaveBeenCalled();
        expect(body).toBe('success');
      }
      for (const secret of [
        'private-openid',
        'private-token',
        'private-ticket',
        '1234567890123456',
        '<Content>',
      ])
        expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
    },
  );

  beforeEach(() => vi.stubEnv('WECHAT_CALLBACK_TOKEN', 'callback-secret'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the exact signed verification echo', () => {
    expect(setup().controller.verify({ ...signed, echostr: '000<&echo' })).toBe(
      '000<&echo',
    );
  });

  it.each([
    { ...signed, signature: 'invalid' },
    { ...signed, timestamp: undefined },
    { ...signed, nonce: '' },
    { ...signed, signature: ['invalid', signed.signature] },
  ])(
    'rejects invalid or missing signature components before side effects',
    async (query) => {
      const { controller, entries, identities, post } = setup();
      expect(() =>
        controller.verify({ ...query, echostr: 'echo' } as never),
      ).toThrow('WECHAT_SIGNATURE_INVALID');
      await expect(post(xml('subscribe'), query)).rejects.toThrow(
        'WECHAT_SIGNATURE_INVALID',
      );
      expect(entries.issue).not.toHaveBeenCalled();
      expect(identities.markUnsubscribed).not.toHaveBeenCalled();
    },
  );

  it('rejects missing or repeated echo values', () => {
    expect(() => setup().controller.verify(signed)).toThrow(
      'WECHAT_SIGNATURE_INVALID',
    );
    expect(() =>
      setup().controller.verify({ ...signed, echostr: ['a', 'b'] } as never),
    ).toThrow('WECHAT_SIGNATURE_INVALID');
  });

  it('requires a configured token in production and cannot verify with an empty token in test', () => {
    vi.stubEnv('WECHAT_CALLBACK_TOKEN', '');
    expect(() =>
      setup().controller.verify({ ...signed, echostr: 'echo' }),
    ).toThrow('WECHAT_SIGNATURE_INVALID');
    vi.stubEnv('NODE_ENV', 'production');
    expect(setup).toThrow('WECHAT_CALLBACK_TOKEN_REQUIRED');
  });

  it.each([
    ['subscribe', ''],
    ['CLICK', 'LOTTERY'],
  ])('issues a welcome reply for %s/%s', async (event, key) => {
    const { entries, reply, post } = setup();
    const body = await post(xml(event!, key));
    expect(entries.issue).toHaveBeenCalledExactlyOnceWith('private-openid');
    expect(reply.header).toHaveBeenCalledWith(
      'Content-Type',
      'text/xml; charset=utf-8',
    );
    expect(body).toContain('欢迎');
    expect(body).toContain('关注');
    expect(body).toContain(
      'https://spark.example/api/activity/entry?t=private-token',
    );
    expect(body).toContain(
      '<ToUserName>private-openid</ToUserName><FromUserName>official-account</FromUserName>',
    );
  });

  it.each([
    ['no-active-activity', '当前暂无可参与的活动'],
    ['multiple-active-activities', '活动配置异常，请联系现场工作人员'],
  ])(
    'returns a business reply without an entry URL for %s',
    async (status, message) => {
      const { entries, post } = setup();
      entries.issue.mockResolvedValue({ status } as never);
      const body = await post(xml('subscribe'));
      expect(body).toContain(message);
      expect(body).not.toContain('http');
    },
  );

  it('marks unsubscribe and acknowledges it as plain text', async () => {
    const { entries, identities, reply, post } = setup();
    expect(await post(xml('unsubscribe'))).toBe('success');
    expect(identities.markUnsubscribed).toHaveBeenCalledExactlyOnceWith(
      'private-openid',
    );
    expect(entries.issue).not.toHaveBeenCalled();
    expect(reply.header).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; charset=utf-8',
    );
  });

  it.each([
    ['CLICK', 'OTHER', 'event'],
    ['SCAN', '', 'event'],
    ['subscribe', '', 'text'],
  ])('ignores other messages: %s/%s/%s', async (event, key, type) => {
    const { entries, identities, post } = setup();
    expect(await post(xml(event!, key, type))).toBe('success');
    expect(entries.issue).not.toHaveBeenCalled();
    expect(identities.markUnsubscribed).not.toHaveBeenCalled();
  });

  it.each(['<xml>invalid</xml>', { Event: 'subscribe' }])(
    'rejects invalid XML without side effects',
    async (body) => {
      const { entries, post } = setup();
      await expect(post(body)).rejects.toThrow('WECHAT_XML_INVALID');
      expect(entries.issue).not.toHaveBeenCalled();
    },
  );

  it.each(['subscribe', 'unsubscribe'])(
    'logs %s service failures without secrets and acknowledges success',
    async (event) => {
      const errorLog = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { entries, identities, post } = setup();
      const error = new Error(
        'SQL private-openid private-token callback-secret',
      );
      entries.issue.mockRejectedValue(error);
      identities.markUnsubscribed.mockRejectedValue(error);
      expect(await post(xml(event))).toBe('success');
      expect(errorLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'wechat.callback.failed',
          requestId: 'request-1',
          eventType: event,
        }),
      );
      const logs = JSON.stringify(errorLog.mock.calls);
      for (const secret of [
        'private-openid',
        'private-token',
        'callback-secret',
        '<xml>',
        'SQL',
      ])
        expect(logs).not.toContain(secret);
    },
  );
});
