import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiGenerationJobs20261125100000 implements MigrationInterface {
  name = 'CreateAiGenerationJobs20261125100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_generation_jobs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "jobType" VARCHAR(40) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
        "payload" JSONB NOT NULL,
        "fileBuffer" BYTEA NULL,
        "result" JSONB NULL,
        "error" TEXT NULL,
        "quotaFeature" VARCHAR(40) NULL,
        "quotaConsumed" BOOLEAN NOT NULL DEFAULT FALSE,
        "quotaRefunded" BOOLEAN NOT NULL DEFAULT FALSE,
        "idempotencyKey" VARCHAR(64) NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMPTZ NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_generation_jobs_user_created"
      ON "ai_generation_jobs" ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_generation_jobs_user_idempotency"
      ON "ai_generation_jobs" ("userId", "idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_generation_jobs_status_created"
      ON "ai_generation_jobs" ("status", "createdAt")
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: user job history and pending work are preserved.
  }
}
