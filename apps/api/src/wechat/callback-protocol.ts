import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_XML_BYTES = 64 * 1024;
const XML_INVALID = 'WECHAT_XML_INVALID';
const XML_ENTITY_PATTERN = /&(amp|lt|gt|quot|apos);/g;
const XML_SCALAR_TAG_PATTERN =
  /<(ToUserName|FromUserName|CreateTime|MsgType|Event|EventKey)>/y;

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
  const fields = parseScalarFields(body);

  const createTimeValue = requireScalar(fields, 'CreateTime');
  const createTime = Number(createTimeValue);
  if (!Number.isFinite(createTime) || !Number.isInteger(createTime)) {
    throw new Error(XML_INVALID);
  }

  return {
    toUserName: requireScalar(fields, 'ToUserName'),
    fromUserName: requireScalar(fields, 'FromUserName'),
    createTime,
    msgType: requireScalar(fields, 'MsgType'),
    event: fields.get('Event'),
    eventKey: fields.get('EventKey'),
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

function requireScalar(fields: Map<string, string>, tagName: string): string {
  const value = fields.get(tagName);
  if (!value) {
    throw new Error(XML_INVALID);
  }
  return value;
}

function parseScalarFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  let cursor = 0;

  while (cursor < body.length) {
    const whitespace = body.slice(cursor).match(/^\s+/)?.[0];
    cursor += whitespace?.length ?? 0;
    if (cursor === body.length) {
      break;
    }

    XML_SCALAR_TAG_PATTERN.lastIndex = cursor;
    const openingTag = XML_SCALAR_TAG_PATTERN.exec(body);
    const tagName = openingTag?.[1];
    if (!openingTag || !tagName || fields.has(tagName)) {
      throw new Error(XML_INVALID);
    }

    const valueStart = XML_SCALAR_TAG_PATTERN.lastIndex;
    const closingTag = `</${tagName}>`;
    const cdataStart = body.slice(valueStart).match(/^\s*<!\[CDATA\[/);
    let closingTagStart: number;

    if (cdataStart) {
      const cdataContentStart = valueStart + cdataStart[0].length;
      const cdataEnd = body.indexOf(']]>', cdataContentStart);
      if (cdataEnd === -1) {
        throw new Error(XML_INVALID);
      }

      closingTagStart = cdataEnd + ']]>'.length;
      while (/\s/.test(body[closingTagStart] ?? '')) {
        closingTagStart += 1;
      }
    } else {
      closingTagStart = body.indexOf(closingTag, valueStart);
      if (closingTagStart === -1) {
        throw new Error(XML_INVALID);
      }
    }

    if (!body.startsWith(closingTag, closingTagStart)) {
      throw new Error(XML_INVALID);
    }

    fields.set(
      tagName,
      decodeScalar(body.slice(valueStart, closingTagStart).trim()),
    );
    cursor = closingTagStart + closingTag.length;
  }

  return fields;
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
