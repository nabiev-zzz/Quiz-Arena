
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Topic {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  difficulty: Difficulty;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  topics: Topic[];
}
