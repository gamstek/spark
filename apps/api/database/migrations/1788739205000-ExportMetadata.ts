import type { MigrationInterface, QueryRunner } from 'typeorm';
export class ExportMetadata1788739205000 implements MigrationInterface {
  name = 'ExportMetadata1788739205000';
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE export_job ADD COLUMN snapshot_at timestamptz, ADD COLUMN expires_at timestamptz, ADD COLUMN row_count integer`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      `ALTER TABLE export_job DROP COLUMN row_count, DROP COLUMN expires_at, DROP COLUMN snapshot_at`,
    );
  }
}
