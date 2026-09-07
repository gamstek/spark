import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityVersionPrizes1788739206000 implements MigrationInterface {
  name = 'ActivityVersionPrizes1788739206000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE activity_version ADD COLUMN activity_name varchar(120);
      UPDATE activity_version v SET activity_name=a.name FROM activity a WHERE a.id=v.activity_id;
      ALTER TABLE activity_version ALTER COLUMN activity_name SET NOT NULL;
      ALTER TABLE activity_version ALTER COLUMN activity_name SET DEFAULT '';
      CREATE TABLE activity_version_prize (
        id uuid PRIMARY KEY,
        activity_version_id uuid NOT NULL REFERENCES activity_version(id) ON DELETE RESTRICT,
        activity_prize_id uuid NOT NULL REFERENCES activity_prize(id) ON DELETE RESTRICT,
        prize_name varchar(120) NOT NULL,
        prize_image_url text,
        weight numeric(12,6) NOT NULL CHECK (weight > 0),
        UNIQUE (activity_version_id, activity_prize_id)
      );
      CREATE INDEX activity_version_prize_version_idx ON activity_version_prize (activity_version_id, activity_prize_id);
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE activity_version_prize; ALTER TABLE activity_version DROP COLUMN activity_name`,
    );
  }
}
