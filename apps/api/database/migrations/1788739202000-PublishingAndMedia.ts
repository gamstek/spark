import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PublishingAndMedia1788739202000 implements MigrationInterface {
  name = 'PublishingAndMedia1788739202000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE activity ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
      ALTER TABLE activity_prize ADD COLUMN prize_name varchar(120);
      ALTER TABLE activity_prize ADD COLUMN prize_image_url text;
      ALTER TABLE stock_adjustment ADD COLUMN operation_id uuid;
      CREATE UNIQUE INDEX stock_adjustment_operation_idx ON stock_adjustment (operation_id) WHERE operation_id IS NOT NULL;
      UPDATE activity_prize ap SET prize_name=p.name FROM prize p WHERE p.id=ap.prize_id;
      ALTER TABLE activity_prize ALTER COLUMN prize_name SET NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX stock_adjustment_operation_idx;
      ALTER TABLE stock_adjustment DROP COLUMN operation_id;
      ALTER TABLE activity_prize DROP COLUMN prize_image_url, DROP COLUMN prize_name;
      ALTER TABLE activity DROP COLUMN revision;
    `);
  }
}
