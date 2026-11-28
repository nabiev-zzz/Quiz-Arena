import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageVoice20261128100000 implements MigrationInterface {
  name = 'AddDirectMessageVoice20261128100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "mediaKey" varchar(500)`);
    await queryRunner.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "mediaType" varchar(100)`);
    await queryRunner.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "durationSeconds" integer`);
  }

  public async down(): Promise<void> {
    // Preserve user voice messages during rollback.
  }
}
