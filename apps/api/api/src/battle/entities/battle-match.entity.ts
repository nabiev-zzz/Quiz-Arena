import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('battle_matches')
@Index('IDX_battle_matches_player_one', ['playerOneId'])
@Index('IDX_battle_matches_player_two', ['playerTwoId'])
@Index('IDX_battle_matches_status', ['status'])
export class BattleMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  roomCode: string;

  @Column({ type: 'varchar', length: 30 })
  mode: string;

  @Column({ type: 'varchar', length: 20, default: 'waiting' })
  status: string;

  @Column({ type: 'uuid' })
  playerOneId: string;

  @Column({ type: 'uuid', nullable: true })
  playerTwoId: string | null;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  questionResults: Record<string, unknown>[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  rankChanges: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  scores: Record<string, number>;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
