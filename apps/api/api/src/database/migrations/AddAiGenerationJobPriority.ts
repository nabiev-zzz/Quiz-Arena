import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiGenerationJobPriority20261125103000 implements MigrationInterface {
  name = 'AddAiGenerationJobPriority20261125103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 50
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive.
  }
}
