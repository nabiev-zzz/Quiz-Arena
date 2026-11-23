
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Question {
  id: string;
  subjectId: string;
  topicId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: Difficulty;
}

export interface GenerateQuestionsRequest {
  subjectId: string;
  topicId: string;
  count: number;
  difficulty: Difficulty;
  language: 'uz' | 'ru' | 'en';
}

export async function generateQuestions(
  apiBaseUrl: string,
  request: GenerateQuestionsRequest,
): Promise<Question[]> {
  const response = await fetch(
   `${apiBaseUrl}/api/ai/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    throw new Error('Savollarni olishda xatolik yuz berdi');
  }

  const data = await response.json();

  if (!Array.isArray(data.questions)) {
    throw new Error('Server noto‘g‘ri savollar formatini yubordi');
  }

  return data.questions as Question[];
}
