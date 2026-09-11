import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, type QueryRunner } from 'typeorm';

export type WechatCallbackResponse = {
  body: string;
  contentType: 'text/plain; charset=utf-8' | 'text/xml; charset=utf-8';
};

type ReceiptRow = {
  body_hash: string;
  response_body: string | null;
  response_content_type: WechatCallbackResponse['contentType'] | null;
};

export class WechatCallbackReplayMismatchError extends Error {
  constructor() {
    super('WECHAT_CALLBACK_REPLAY_MISMATCH');
  }
}

const FALLBACK_RESPONSE: WechatCallbackResponse = {
  body: 'success',
  contentType: 'text/plain; charset=utf-8',
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class WechatCallbackReplayService {
  private readonly statementTimeoutMs: number;
  private readonly lockTimeoutMs: number;

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly deadlineMs = 4_000,
  ) {
    this.statementTimeoutMs = Math.max(
      1,
      Math.min(2_500, Math.floor(deadlineMs * 0.6)),
    );
    this.lockTimeoutMs = Math.max(
      1,
      Math.min(1_500, Math.floor(deadlineMs * 0.3)),
    );
  }

  async execute(
    input: { method: 'POST'; timestamp: string; nonce: string; body: string },
    work: (
      manager: EntityManager,
      signal: AbortSignal,
    ) => Promise<WechatCallbackResponse>,
  ): Promise<WechatCallbackResponse> {
    const abort = new AbortController();
    const runner = this.dataSource.createQueryRunner();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = this.perform(runner, input, work, abort.signal);
    operation.catch(() => undefined);

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error('WECHAT_CALLBACK_DEADLINE'));
          }, this.deadlineMs);
        }),
      ]);
    } catch (error) {
      abort.abort();
      if (error instanceof WechatCallbackReplayMismatchError) throw error;
      if (runner.isTransactionActive) void runner.rollbackTransaction();
      return FALLBACK_RESPONSE;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async perform(
    runner: QueryRunner,
    input: { method: 'POST'; timestamp: string; nonce: string; body: string },
    work: (
      manager: EntityManager,
      signal: AbortSignal,
    ) => Promise<WechatCallbackResponse>,
    signal: AbortSignal,
  ): Promise<WechatCallbackResponse> {
    try {
      await runner.connect();
      this.assertActive(signal);
      await runner.startTransaction();
      await runner.query(
        `SELECT set_config('statement_timeout',$1,true),
                set_config('lock_timeout',$2,true)`,
        [`${this.statementTimeoutMs}ms`, `${this.lockTimeoutMs}ms`],
      );
      const requestKey = digest(
        `${input.method}\0${input.timestamp}\0${input.nonce}`,
      );
      const bodyHash = digest(input.body);
      await runner.query(
        `INSERT INTO wechat_callback_receipt (request_key,body_hash)
         VALUES ($1,$2) ON CONFLICT (request_key) DO NOTHING`,
        [requestKey, bodyHash],
      );
      const receipts = await runner.manager.query<ReceiptRow[]>(
        `SELECT body_hash,response_body,response_content_type
         FROM wechat_callback_receipt WHERE request_key=$1 FOR UPDATE`,
        [requestKey],
      );
      const receipt = receipts[0];
      if (!receipt || receipt.body_hash !== bodyHash)
        throw new WechatCallbackReplayMismatchError();
      if (receipt.response_body && receipt.response_content_type) {
        await runner.commitTransaction();
        return {
          body: receipt.response_body,
          contentType: receipt.response_content_type,
        };
      }

      this.assertActive(signal);
      const response = await work(runner.manager, signal);
      this.assertActive(signal);
      await runner.manager.query(
        `UPDATE wechat_callback_receipt
         SET response_body=$2,response_content_type=$3 WHERE request_key=$1`,
        [requestKey, response.body, response.contentType],
      );
      this.assertActive(signal);
      await runner.commitTransaction();
      return response;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private assertActive(signal: AbortSignal): void {
    if (signal.aborted) throw new Error('WECHAT_CALLBACK_DEADLINE');
  }
}
