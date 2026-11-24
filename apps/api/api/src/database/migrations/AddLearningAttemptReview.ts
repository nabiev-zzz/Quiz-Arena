import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLearningAttemptReview20261124235000 implements MigrationInterface {
  name = 'AddLearningAttemptReview20261124235000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE learning_attempts
      ADD COLUMN IF NOT EXISTS review JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(): Promise<void> {
    // Existing test history must remain available; no destructive rollback.
  }
}
