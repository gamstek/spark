import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LotteryDrawRules1788739211000 implements MigrationInterface {
  name = 'LotteryDrawRules1788739211000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE activity_version
       SET config='{"winningProbability":0,"halfDayPrizeLimits":{}}'::jsonb || config
       WHERE NOT (config ? 'winningProbability') OR NOT (config ? 'halfDayPrizeLimits')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE activity_version SET config=config - 'winningProbability' - 'halfDayPrizeLimits'`,
    );
  }
}
