import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WechatSubscriptionCache1788739201000 implements MigrationInterface {
  name = 'WechatSubscriptionCache1788739201000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wechat_identity ADD COLUMN subscribed boolean;
      ALTER TABLE wechat_identity ADD COLUMN subscription_checked_at timestamptz;
      CREATE INDEX wechat_identity_subscription_cache_idx ON wechat_identity (subscription_checked_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX wechat_identity_subscription_cache_idx; ALTER TABLE wechat_identity DROP COLUMN subscription_checked_at, DROP COLUMN subscribed;`);
  }
}
