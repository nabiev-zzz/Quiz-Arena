import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommunitySocial20261126180000 implements MigrationInterface {
  name = 'CreateCommunitySocial20261126180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "authorId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        content varchar(2000) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_posts_created" ON community_posts ("createdAt" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_posts_author_created" ON community_posts ("authorId", "createdAt" DESC)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_post_likes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" uuid NOT NULL REFERENCES community_posts(id) ON DELETE RESTRICT,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_community_post_likes_pair" UNIQUE ("postId", "userId")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_post_likes_post" ON community_post_likes ("postId")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_post_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" uuid NOT NULL REFERENCES community_posts(id) ON DELETE RESTRICT,
        "authorId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        content varchar(1000) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_community_post_comments_post_created" ON community_post_comments ("postId", "createdAt" ASC)`);
  }

  public async down(): Promise<void> {
    // User-generated community content is preserved on rollback.
  }
}
