import type { MigrationInterface, QueryRunner } from 'typeorm';

import { WechatActivityEntryTokens1788739208000 } from './1788739208000-WechatActivityEntryTokens.js';
import { WechatCallbackReceipts1788739209000 } from './1788739209000-WechatCallbackReceipts.js';

export class DropWechatEventActivityEntry1788739210000 implements MigrationInterface {
  name = 'DropWechatEventActivityEntry1788739210000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS wechat_callback_receipt;
      DROP TABLE IF EXISTS wechat_activity_entry_token;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await new WechatActivityEntryTokens1788739208000().up(queryRunner);
    await new WechatCallbackReceipts1788739209000().up(queryRunner);
  }
}
