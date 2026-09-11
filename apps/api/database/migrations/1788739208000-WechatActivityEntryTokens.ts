import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WechatActivityEntryTokens1788739208000 implements MigrationInterface {
  name = 'WechatActivityEntryTokens1788739208000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wechat_activity_entry_token (
        id uuid PRIMARY KEY,
        token_hash varchar(64) NOT NULL,
        user_id uuid NOT NULL REFERENCES user_account(id),
        activity_id uuid NOT NULL REFERENCES activity(id),
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT wechat_activity_entry_token_hash_key UNIQUE (token_hash)
      );
      CREATE INDEX wechat_activity_entry_token_cleanup_idx
      ON wechat_activity_entry_token (expires_at, consumed_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX wechat_activity_entry_token_cleanup_idx; DROP TABLE wechat_activity_entry_token`,
    );
  }
}
