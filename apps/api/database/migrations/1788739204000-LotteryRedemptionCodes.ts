import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LotteryRedemptionCodes1788739204000 implements MigrationInterface {
  name = 'LotteryRedemptionCodes1788739204000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE redemption ADD COLUMN encrypted_code text, ADD COLUMN encryption_key_id varchar(64)`);
    await queryRunner.query(`ALTER TABLE lottery_record ADD COLUMN prize_name varchar(120), ADD COLUMN prize_image_url text, ADD COLUMN redeem_end_at timestamptz`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE lottery_record DROP COLUMN redeem_end_at, DROP COLUMN prize_image_url, DROP COLUMN prize_name`);
    await queryRunner.query(`ALTER TABLE redemption DROP COLUMN encryption_key_id, DROP COLUMN encrypted_code`);
  }
}
