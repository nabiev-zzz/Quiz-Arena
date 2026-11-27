import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityClipInteractions20261127050000 implements MigrationInterface {
  name = 'AddCommunityClipInteractions20261127050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE community_post_comments ADD COLUMN IF NOT EXISTS "parentId" uuid NULL');
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE community_post_comments
          ADD CONSTRAINT "FK_community_post_comments_parent"
          FOREIGN KEY ("parentId") REFERENCES community_post_comments(id) ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_community_post_comments_parent" ON community_post_comments ("parentId", "createdAt" ASC)');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_post_saves (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" uuid NOT NULL REFERENCES community_posts(id) ON DELETE RESTRICT,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_community_post_saves_pair" UNIQUE ("postId", "userId")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_community_post_saves_post" ON community_post_saves ("postId")');
  }

  public async down(): Promise<void> {
    // Keep user saves and comment replies intact during rollback; schema rollback is intentionally non-destructive.
  }
}
