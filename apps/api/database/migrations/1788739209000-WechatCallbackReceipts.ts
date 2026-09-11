import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WechatCallbackReceipts1788739209000 implements MigrationInterface {
  name = 'WechatCallbackReceipts1788739209000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wechat_callback_receipt (
        request_key varchar(64) PRIMARY KEY,
        body_hash varchar(64) NOT NULL,
        response_body text,
        response_content_type varchar(64),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX wechat_callback_receipt_created_idx
      ON wechat_callback_receipt (created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX wechat_callback_receipt_created_idx; DROP TABLE wechat_callback_receipt`,
    );
  }
}
