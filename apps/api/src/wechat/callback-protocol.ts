import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_XML_BYTES = 64 * 1024;
const XML_INVALID = 'WECHAT_XML_INVALID';
const XML_ENTITY_PATTERN = /&(amp|lt|gt|quot|apos);/g;
const XML_SCALAR_FIELD_PATTERN =
  /<(?:ToUserName|FromUserName|CreateTime|MsgType|Event|EventKey)>([\s\S]*?)<\/(?:ToUserName|FromUserName|CreateTime|MsgType|Event|EventKey)>/g;

export interface WechatEvent {
  toUserName: string;
  fromUserName: string;
  createTime: number;
  msgType: string;
  event?: string;
  eventKey?: string;
}

export function verifyWechatSignature(input: {
  token: string;
  timestamp: string;
  nonce: string;
  signature: string;
}): boolean {
  const expected = createHash('sha1')
    .update([input.token, input.timestamp, input.nonce].sort().join(''))
    .digest();

  if (!/^[0-9a-f]{40}$/i.test(input.signature)) {
    return false;
  }

  const received = Buffer.from(input.signature, 'hex');
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function parseWechatEventXml(xml: string): WechatEvent {
  if (
    Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES ||
    /<!(?:DOCTYPE|ENTITY)\b/i.test(xml) ||
    /<\?/.test(xml)
  ) {
    throw new Error(XML_INVALID);
  }

  const root = xml.trim();
  if (!root.startsWith('<xml>') || !root.endsWith('</xml>')) {
    throw new Error(XML_INVALID);
  }

  const body = root.slice('<xml>'.length, -'</xml>'.length);
  if (body.replace(XML_SCALAR_FIELD_PATTERN, '').trim()) {
    throw new Error(XML_INVALID);
  }

  const createTimeValue = requireScalar(body, 'CreateTime');
  const createTime = Number(createTimeValue);
  if (!Number.isFinite(createTime) || !Number.isInteger(createTime)) {
    throw new Error(XML_INVALID);
  }

  return {
    toUserName: requireScalar(body, 'ToUserName'),
    fromUserName: requireScalar(body, 'FromUserName'),
    createTime,
    msgType: requireScalar(body, 'MsgType'),
    event: optionalScalar(body, 'Event'),
    eventKey: optionalScalar(body, 'EventKey'),
  };
}

export function renderTextReply(input: {
  toUserName: string;
  fromUserName: string;
  createTime: number;
  content: string;
}): string {
  return `<xml><ToUserName>${escapeXml(input.fromUserName)}</ToUserName><FromUserName>${escapeXml(input.toUserName)}</FromUserName><CreateTime>${input.createTime}</CreateTime><MsgType>text</MsgType><Content>${escapeXml(input.content)}</Content></xml>`;
}

function requireScalar(xml: string, tagName: string): string {
  const value = optionalScalar(xml, tagName);
  if (!value) {
    throw new Error(XML_INVALID);
  }
  return value;
}

function optionalScalar(xml: string, tagName: string): string | undefined {
  const matches = [
    ...xml.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'g')),
  ];
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length !== 1) {
    throw new Error(XML_INVALID);
  }

  const match = matches[0];
  const value = match?.[1];
  if (value === undefined) {
    throw new Error(XML_INVALID);
  }
  return decodeScalar(value.trim());
}

function decodeScalar(value: string): string {
  if (value.startsWith('<![CDATA[')) {
    if (!value.endsWith(']]>')) {
      throw new Error(XML_INVALID);
    }

    const cdata = value.slice('<![CDATA['.length, -']]>'.length);
    if (cdata.includes(']]>')) {
      throw new Error(XML_INVALID);
    }
    return cdata;
  }

  if (value.includes('<')) {
    throw new Error(XML_INVALID);
  }

  const unrecognizedEntities = value.replace(XML_ENTITY_PATTERN, '');
  if (unrecognizedEntities.includes('&')) {
    throw new Error(XML_INVALID);
  }

  return value.replace(XML_ENTITY_PATTERN, (_, entity: string) => {
    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return '';
    }
  });
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return '';
    }
  });
}
