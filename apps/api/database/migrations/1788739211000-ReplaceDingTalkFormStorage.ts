import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceDingTalkFormStorage1788739211000 implements MigrationInterface {
  name = 'ReplaceDingTalkFormStorage1788739211000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema=current_schema()
            AND table_name='activity_participation'
            AND column_name='adopted_submission_id'
        ) THEN
          ALTER TABLE activity_participation
            DROP CONSTRAINT IF EXISTS activity_participation_adopted_submission_fk;
          UPDATE activity_participation
          SET lead_completed=false, lead_completed_at=NULL, updated_at=now()
          WHERE adopted_submission_id IS NOT NULL;
          ALTER TABLE activity_participation DROP COLUMN adopted_submission_id;
        END IF;
      END $$;

      UPDATE activity_version
      SET config=config - ARRAY['formId','formUrl','prefillField','fieldMapping']
      WHERE config ?| ARRAY['formId','formUrl','prefillField','fieldMapping'];

      DELETE FROM background_job WHERE kind='DINGTALK_SUBMISSION';
      DROP TABLE IF EXISTS webhook_receipt;
      DROP TABLE IF EXISTS dingtalk_form_submission;

      -- This no-op is only for databases rebuilt with the withdrawn baseline,
      -- which already created this exact replacement table before this forward
      -- migration existed.
      CREATE TABLE IF NOT EXISTS activity_form_submission (
        id uuid PRIMARY KEY,
        participation_id uuid NOT NULL REFERENCES activity_participation(id) ON DELETE RESTRICT,
        answers jsonb NOT NULL,
        submitted_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT activity_form_submission_participation_key UNIQUE (participation_id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    throw new Error(
      'IRREVERSIBLE_DINGTALK_STORAGE_REMOVAL: deleted DingTalk answers cannot be restored',
    );
  }
}
