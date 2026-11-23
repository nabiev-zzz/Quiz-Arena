import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBattleMatches20261122210000
  implements MigrationInterface
{
  name = 'CreateBattleMatches20261122210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "battle_matches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "roomCode" varchar(20) NOT NULL,
        "mode" varchar(30) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'waiting',
        "playerOneId" uuid NOT NULL,
        "playerTwoId" uuid,
        "winnerId" uuid,
        "questionResults" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "scores" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "startedAt" timestamptz,
        "finishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_battle_matches" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_battle_matches_room_code" UNIQUE ("roomCode"),
        CONSTRAINT "FK_battle_matches_player_one"
          FOREIGN KEY ("playerOneId") REFERENCES "users"("id"),
        CONSTRAINT "FK_battle_matches_player_two"
          FOREIGN KEY ("playerTwoId") REFERENCES "users"("id"),
        CONSTRAINT "FK_battle_matches_winner"
          FOREIGN KEY ("winnerId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_battle_matches_player_one"
      ON "battle_matches" ("playerOneId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_battle_matches_player_two"
      ON "battle_matches" ("playerTwoId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_battle_matches_status"
      ON "battle_matches" ("status")
    `);
  }

  public async down(): Promise<void> {
    // Ataylab bo'sh: foydalanuvchi ma'lumotlari o'chirilmaydi.
  }
}
