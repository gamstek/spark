import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { WechatActivityEntryService } from './activity-entry.service.js';
import {
  parseWechatEventXml,
  renderTextReply,
  verifyWechatSignature,
} from './callback-protocol.js';
import { WechatIdentityService } from './wechat-identity.service.js';

type CallbackQuery = {
  signature?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  echostr?: unknown;
};

@Controller('wechat/callback')
export class WechatCallbackController {
  private readonly logger = new Logger(WechatCallbackController.name);
  private readonly token = process.env.WECHAT_CALLBACK_TOKEN ?? '';

  constructor(
    @Inject(WechatActivityEntryService)
    private readonly entries: WechatActivityEntryService,
    @Inject(WechatIdentityService)
    private readonly identities: WechatIdentityService,
  ) {
    if (process.env.NODE_ENV === 'production' && !this.token.trim()) {
      throw new Error('WECHAT_CALLBACK_TOKEN_REQUIRED');
    }
  }

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verify(@Query() query: CallbackQuery): string {
    this.verifySignature(query);
    if (typeof query.echostr !== 'string')
      throw new ForbiddenException('WECHAT_SIGNATURE_INVALID');
    return query.echostr;
  }

  @Post()
  @HttpCode(200)
  async callback(
    @Query() query: CallbackQuery,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    this.verifySignature(query);
    if (typeof body !== 'string')
      throw new BadRequestException('WECHAT_XML_INVALID');
    const event = parseWechatEventXml(body);
    const eventType =
      event.msgType === 'event' &&
      ['subscribe', 'unsubscribe', 'CLICK'].includes(event.event ?? '')
        ? event.event
        : 'other';
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    try {
      if (event.msgType === 'event') {
        if (event.event === 'unsubscribe') {
          await this.identities.markUnsubscribed(event.fromUserName);
        } else if (
          event.event === 'subscribe' ||
          (event.event === 'CLICK' && event.eventKey === 'LOTTERY')
        ) {
          const result = await this.entries.issue(event.fromUserName);
          const content =
            result.status === 'issued'
              ? `欢迎关注！点击链接参与活动：${result.url}`
              : result.status === 'no-active-activity'
                ? '当前暂无可参与的活动，请稍后再试。'
                : '活动配置异常，请联系现场工作人员。';
          this.logger.log({
            event: 'wechat.callback.handled',
            requestId: request.id,
            eventType,
            outcome: result.status,
          });
          reply.header('Content-Type', 'text/xml; charset=utf-8');
          return reply.send(
            renderTextReply({
              ...event,
              createTime: Math.floor(Date.now() / 1000),
              content,
            }),
          );
        }
      }
      this.logger.log({
        event: 'wechat.callback.handled',
        requestId: request.id,
        eventType,
        outcome: 'success',
      });
    } catch {
      this.logger.error({
        event: 'wechat.callback.failed',
        requestId: request.id,
        eventType,
        outcome: 'success',
      });
    }
    return reply.send('success');
  }

  private verifySignature(query: CallbackQuery): void {
    const { timestamp, nonce, signature } = query;
    if (
      !this.token.trim() ||
      typeof timestamp !== 'string' ||
      !timestamp ||
      typeof nonce !== 'string' ||
      !nonce ||
      typeof signature !== 'string' ||
      !signature ||
      !verifyWechatSignature({ token: this.token, timestamp, nonce, signature })
    ) {
      throw new ForbiddenException('WECHAT_SIGNATURE_INVALID');
    }
  }
}
