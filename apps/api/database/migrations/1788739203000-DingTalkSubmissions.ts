import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DingTalkSubmissions1788739203000 implements MigrationInterface {
  name = 'DingTalkSubmissions1788739203000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // The missing table identifies only databases created by the withdrawn,
    // rewritten InitialSchema. Mark this historical migration applied there so
    // the later forward migration can converge the already-correct form table.
    if (!(await queryRunner.hasTable('dingtalk_form_submission'))) return;
    await queryRunner.query(
      `ALTER TABLE activity_participation ADD COLUMN adopted_submission_id uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE activity_participation ADD CONSTRAINT activity_participation_adopted_submission_fk FOREIGN KEY (adopted_submission_id) REFERENCES dingtalk_form_submission(id) ON DELETE RESTRICT`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activity_participation DROP CONSTRAINT IF EXISTS activity_participation_adopted_submission_fk`,
    );
    await queryRunner.query(
      `ALTER TABLE activity_participation DROP COLUMN IF EXISTS adopted_submission_id`,
    );
  }
}
