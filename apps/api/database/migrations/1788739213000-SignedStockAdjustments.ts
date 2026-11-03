import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SignedStockAdjustments1788739213000 implements MigrationInterface {
  name = 'SignedStockAdjustments1788739213000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stock_adjustment DROP CONSTRAINT stock_adjustment_quantity_check;
      ALTER TABLE stock_adjustment ADD CONSTRAINT stock_adjustment_quantity_check CHECK (quantity <> 0);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Preserve the audit trail: a database containing reductions cannot use the
    // original positive-only constraint until those records are accounted for.
    await queryRunner.query(`
      ALTER TABLE stock_adjustment DROP CONSTRAINT stock_adjustment_quantity_check;
      ALTER TABLE stock_adjustment ADD CONSTRAINT stock_adjustment_quantity_check CHECK (quantity > 0);
    `);
  }
}
