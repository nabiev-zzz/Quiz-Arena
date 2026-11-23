import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('battle_questions')
@Index('IDX_battle_questions_filter', [
  'categoryId',
  'language',
  'difficulty',
  'isActive',
])
export class BattleQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 5, default: 'uz' })
  language: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'jsonb' })
  options: string[];

  // To‘g‘ri javob indeksi: 0, 1, 2 yoki 3.
  // Bu qiymat o‘yin davomida raqibga yuborilmaydi.
  @Column({ type: 'smallint' })
  correctAnswer: number;

  @Column({ type: 'text', default: '' })
  explanation: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  difficulty: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}