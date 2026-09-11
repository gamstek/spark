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
import type { EntityManager } from 'typeorm';

import { WechatActivityEntryService } from './activity-entry.service.js';
import {
  parseWechatEventXml,
  renderTextReply,
  verifyWechatSignature,
} from './callback-protocol.js';
import {
  WechatCallbackReplayMismatchError,
  WechatCallbackReplayService,
  type WechatCallbackResponse,
} from './callback-replay.service.js';
import { WechatIdentityService } from './wechat-identity.service.js';

type CallbackQuery = {
  signature?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  echostr?: unknown;
};

const CALLBACK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

@Controller('wechat/callback')
export class WechatCallbackController {
  private readonly logger = new Logger(WechatCallbackController.name);
  private readonly token = process.env.WECHAT_CALLBACK_TOKEN ?? '';

  constructor(
    @Inject(WechatActivityEntryService)
    private readonly entries: WechatActivityEntryService,
    @Inject(WechatIdentityService)
    private readonly identities: WechatIdentityService,
    @Inject(WechatCallbackReplayService)
    private readonly replays: WechatCallbackReplayService,
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
    const eventType: string =
      event.msgType === 'event' &&
      ['subscribe', 'unsubscribe', 'CLICK'].includes(event.event ?? '')
        ? event.event!
        : 'other';
    try {
      const response = await this.replays.execute(
        {
          method: 'POST',
          timestamp: query.timestamp as string,
          nonce: query.nonce as string,
          body,
        },
        (manager, signal) =>
          this.handleEvent(event, eventType, request.id, manager, signal),
      );
      return reply
        .header('Content-Type', response.contentType)
        .send(response.body);
    } catch (error) {
      if (error instanceof WechatCallbackReplayMismatchError)
        throw new ForbiddenException('WECHAT_CALLBACK_REPLAY_MISMATCH');
      throw error;
    }
  }

  private async handleEvent(
    event: ReturnType<typeof parseWechatEventXml>,
    eventType: string,
    requestId: string | undefined,
    manager: EntityManager,
    signal: AbortSignal,
  ): Promise<WechatCallbackResponse> {
    try {
      if (event.msgType === 'event') {
        if (event.event === 'unsubscribe') {
          await this.identities.applySubscriptionEvent(
            event.fromUserName,
            false,
            new Date(event.createTime * 1000),
            manager,
            signal,
          );
        } else if (
          event.event === 'subscribe' ||
          (event.event === 'CLICK' && event.eventKey === 'LOTTERY')
        ) {
          const result = await this.entries.issue(
            event.fromUserName,
            new Date(event.createTime * 1000),
            manager,
            signal,
          );
          if (result.status === 'stale-event')
            return {
              body: 'success',
              contentType: 'text/plain; charset=utf-8',
            };
          const content =
            result.status === 'issued'
              ? `欢迎关注！点击链接参与活动：${result.url}`
              : result.status === 'no-active-activity'
                ? '当前暂无可参与的活动，请稍后再试。'
                : '活动配置异常，请联系现场工作人员。';
          this.logger.log({
            event: 'wechat.callback.handled',
            requestId,
            eventType,
            outcome: result.status,
          });
          return {
            body: renderTextReply({
              ...event,
              createTime: Math.floor(Date.now() / 1000),
              content,
            }),
            contentType: 'text/xml; charset=utf-8',
          };
        }
      }
      this.logger.log({
        event: 'wechat.callback.handled',
        requestId,
        eventType,
        outcome: 'success',
      });
    } catch {
      this.logger.error({
        event: 'wechat.callback.failed',
        requestId,
        eventType,
        outcome: 'success',
      });
    }
    return { body: 'success', contentType: 'text/plain; charset=utf-8' };
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
      !this.isFreshTimestamp(timestamp) ||
      !verifyWechatSignature({ token: this.token, timestamp, nonce, signature })
    ) {
      throw new ForbiddenException('WECHAT_SIGNATURE_INVALID');
    }
  }

  private isFreshTimestamp(timestamp: string): boolean {
    if (!/^\d{1,12}$/.test(timestamp)) return false;
    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return (
      Number.isSafeInteger(timestampSeconds) &&
      Math.abs(nowSeconds - timestampSeconds) <=
        CALLBACK_TIMESTAMP_TOLERANCE_SECONDS
    );
  }
}
