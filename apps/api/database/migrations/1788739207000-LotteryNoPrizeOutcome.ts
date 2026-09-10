import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LotteryNoPrizeOutcome1788739207000 implements MigrationInterface {
  name = 'LotteryNoPrizeOutcome1788739207000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activity_participation ADD COLUMN drawn_at timestamptz`,
    );
    await queryRunner.query(
      `UPDATE activity_version SET config=config || '{"noPrizeWeight":1}'::jsonb WHERE NOT (config ? 'noPrizeWeight')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE activity_version SET config=config - 'noPrizeWeight'`,
    );
    await queryRunner.query(
      `ALTER TABLE activity_participation DROP COLUMN drawn_at`,
    );
  }
}
