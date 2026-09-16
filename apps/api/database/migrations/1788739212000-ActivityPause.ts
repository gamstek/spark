import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityPause1788739212000 implements MigrationInterface {
  name = 'ActivityPause1788739212000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activity ADD COLUMN paused_at timestamptz NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE activity DROP COLUMN paused_at`);
  }
}
