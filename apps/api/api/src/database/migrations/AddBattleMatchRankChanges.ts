import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBattleMatchRankChanges20261124040000
  implements MigrationInterface
{
  name = 'AddBattleMatchRankChanges20261124040000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE battle_matches
      ADD COLUMN IF NOT EXISTS "rankChanges"
      JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  async down(): Promise<void> {
    // Rank natijalarini saqlab qolamiz; ustun avtomatik o'chirilmaydi.
  }
}
