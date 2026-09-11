import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  parseWechatEventXml,
  renderTextReply,
  verifyWechatSignature,
} from './callback-protocol.js';

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

const validSignatureInput = {
  token: 'callback-secret',
  timestamp: '1789123456',
  nonce: 'nonce-value',
  signature: sha1(
    ['callback-secret', '1789123456', 'nonce-value'].sort().join(''),
  ),
};

const subscribeEventXml = `<xml>
  <ToUserName><![CDATA[official-account]]></ToUserName>
  <FromUserName><![CDATA[wechat-user]]></FromUserName>
  <CreateTime>1789123456</CreateTime>
  <MsgType><![CDATA[event]]></MsgType>
  <Event><![CDATA[subscribe]]></Event>
</xml>`;

describe('verifyWechatSignature', () => {
  it('accepts WeChat signatures made from the sorted token, timestamp, and nonce', () => {
    expect(verifyWechatSignature(validSignatureInput)).toBe(true);
  });

  it('rejects signatures with a different length or value', () => {
    expect(
      verifyWechatSignature({ ...validSignatureInput, signature: 'bad' }),
    ).toBe(false);
    expect(
      verifyWechatSignature({
        ...validSignatureInput,
        signature: `${validSignatureInput.signature.slice(0, -1)}0`,
      }),
    ).toBe(false);
  });
});

describe('parseWechatEventXml', () => {
  it.each([
    [
      'event',
      '<Event>subscribe</Event><EventKey>qrscene_123</EventKey><Ticket><![CDATA[private-ticket]]></Ticket>',
      'subscribe',
      'qrscene_123',
    ],
    [
      'text',
      '<Content><![CDATA[Hello <Event>subscribe</Event>]]></Content><MsgId>1234567890123456</MsgId>',
      undefined,
      undefined,
    ],
    [
      'event',
      '<Event>SCAN</Event><EventKey>123</EventKey><Ticket><![CDATA[private-ticket]]></Ticket>',
      'SCAN',
      '123',
    ],
  ])(
    'extracts only dispatch fields from realistic %s messages: %s',
    (msgType, fields, event, eventKey) => {
      expect(
        parseWechatEventXml(
          `<xml><ToUserName>official-account</ToUserName><FromUserName>wechat-user</FromUserName><CreateTime>1789123456</CreateTime><MsgType>${msgType}</MsgType>${fields}</xml>`,
        ),
      ).toEqual({
        toUserName: 'official-account',
        fromUserName: 'wechat-user',
        createTime: 1789123456,
        msgType,
        event,
        eventKey,
      });
    },
  );

  it.each([
    '<Ticket><Event>subscribe</Event></Ticket>',
    '<xml></xml>',
    '<Ticket>bad]]>text</Ticket>',
    '<Ticket>bad</EventKey>',
    '<Ticket>&external;</Ticket>',
    '<Ticket><![CDATA[unterminated</Ticket>',
    '<Ticket><![CDATA[one]]>trailing</Ticket>',
    '<Ticket>one</Ticket><Ticket>two</Ticket>',
    '<Event>CLICK</Event>',
    '<FromUserName>other-user</FromUserName>',
    '<Ticket attr="value">ticket</Ticket>',
    '<Ticket/><!-- comment -->',
    '<?processing instruction?>',
    '<!DOCTYPE xml [<!ENTITY external SYSTEM "file:///secret">]>',
  ])(
    'validates ignored fields and rejects malformed or duplicate structure: %s',
    (extra) => {
      expect(() =>
        parseWechatEventXml(
          subscribeEventXml.replace('</xml>', `${extra}</xml>`),
        ),
      ).toThrow('WECHAT_XML_INVALID');
    },
  );

  it('parses a subscribe event with documented scalar fields', () => {
    expect(parseWechatEventXml(subscribeEventXml)).toEqual({
      toUserName: 'official-account',
      fromUserName: 'wechat-user',
      createTime: 1789123456,
      msgType: 'event',
      event: 'subscribe',
    });
  });

  it('preserves uppercase click events and decodes EventKey text', () => {
    expect(
      parseWechatEventXml(`<xml>
        <ToUserName>official&amp;account</ToUserName>
        <FromUserName>wechat-user</FromUserName>
        <CreateTime>1789123457</CreateTime>
        <MsgType>event</MsgType>
        <Event>CLICK</Event>
        <EventKey>LOTTERY&amp;VIP</EventKey>
      </xml>`),
    ).toEqual({
      toUserName: 'official&account',
      fromUserName: 'wechat-user',
      createTime: 1789123457,
      msgType: 'event',
      event: 'CLICK',
      eventKey: 'LOTTERY&VIP',
    });
  });

  it('rejects an optional scalar whose closing tag does not match', () => {
    expect(() =>
      parseWechatEventXml(`<xml>
        <ToUserName>official-account</ToUserName>
        <FromUserName>wechat-user</FromUserName>
        <CreateTime>1789123457</CreateTime>
        <MsgType>event</MsgType>
        <Event>CLICK</EventKey>
      </xml>`),
    ).toThrow('WECHAT_XML_INVALID');
  });

  it('preserves tag-shaped text inside a CDATA scalar', () => {
    expect(
      parseWechatEventXml(`<xml>
        <ToUserName>official-account</ToUserName>
        <FromUserName>wechat-user</FromUserName>
        <CreateTime>1789123457</CreateTime>
        <MsgType>event</MsgType>
        <EventKey><![CDATA[<Event>CLICK</Event>]]></EventKey>
      </xml>`),
    ).toMatchObject({ eventKey: '<Event>CLICK</Event>' });
  });

  it.each([
    '<!DOCTYPE xml><xml></xml>',
    '<!ENTITY boom "boom"><xml></xml>',
    `<xml>
      <ToUserName>official-account</ToUserName>
      <FromUserName>wechat-user</FromUserName>
      <CreateTime>1789123456</CreateTime>
    </xml>`,
    `<xml>
      <ToUserName>official-account</ToUserName>
      <FromUserName>wechat-user</FromUserName>
      <CreateTime>1.5</CreateTime>
      <MsgType>event</MsgType>
    </xml>`,
    `<xml></xml><ToUserName>official-account</ToUserName>
      <FromUserName>wechat-user</FromUserName>
      <CreateTime>1789123456</CreateTime>
      <MsgType>event</MsgType></xml>`,
    `<xml><ToUserName>${'x'.repeat(65_537)}</ToUserName></xml>`,
  ])('rejects unsafe or malformed XML', (xml) => {
    expect(() => parseWechatEventXml(xml)).toThrow('WECHAT_XML_INVALID');
  });
});

describe('renderTextReply', () => {
  it('reverses sender and recipient and escapes text reply content', () => {
    expect(
      renderTextReply({
        toUserName: 'official&account',
        fromUserName: 'wechat<user',
        createTime: 1789123458,
        content: 'A & B < C ]]>',
      }),
    ).toBe(
      '<xml><ToUserName>wechat&lt;user</ToUserName><FromUserName>official&amp;account</FromUserName><CreateTime>1789123458</CreateTime><MsgType>text</MsgType><Content>A &amp; B &lt; C ]]&gt;</Content></xml>',
    );
  });
});
