import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PrepareWithdrawnFormBaseline1788739202500 implements MigrationInterface {
  name = 'PrepareWithdrawnFormBaseline1788739202500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('activity_form_submission') IS NOT NULL
          AND to_regclass('dingtalk_form_submission') IS NULL THEN
          CREATE TABLE dingtalk_form_submission (
            id uuid PRIMARY KEY, form_id varchar(128) NOT NULL, record_id varchar(256) NOT NULL,
            participation_id uuid NOT NULL REFERENCES activity_participation(id) ON DELETE RESTRICT,
            fields jsonb NOT NULL, submitted_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (form_id, record_id)
          );
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    throw new Error(
      'IRREVERSIBLE_WITHDRAWN_BASELINE_COMPATIBILITY: do not undo migration history',
    );
  }
}
