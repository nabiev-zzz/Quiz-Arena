import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityMediaAndStories20261126190000 implements MigrationInterface {
  name = 'AddCommunityMediaAndStories20261126190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS "mediaKey" varchar(500)`);
    await queryRunner.query(`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS "mediaType" varchar(100)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_stories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "authorId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "mediaKey" varchar(500) NOT NULL,
        "mediaType" varchar(100) NOT NULL DEFAULT 'image/jpeg',
        caption varchar(300) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "expiresAt" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_stories_expires" ON community_stories ("expiresAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_stories_author_created" ON community_stories ("authorId", "createdAt" DESC)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_story_views (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "storyId" uuid NOT NULL REFERENCES community_stories(id) ON DELETE RESTRICT,
        "viewerId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_community_story_views_pair" UNIQUE ("storyId", "viewerId")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_story_views_story" ON community_story_views ("storyId")`);
  }

  public async down(): Promise<void> {
    // Keep user media and story history intact during rollback.
  }
}
