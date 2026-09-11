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
