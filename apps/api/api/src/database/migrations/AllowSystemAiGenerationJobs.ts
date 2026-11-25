import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowSystemAiGenerationJobs20261125102000 implements MigrationInterface {
  name = 'AllowSystemAiGenerationJobs20261125102000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ALTER COLUMN "userId" DROP NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_generation_jobs_system_idempotency"
      ON "ai_generation_jobs" ("idempotencyKey")
      WHERE "userId" IS NULL AND "idempotencyKey" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive.
  }
}
