export interface DocumentQuizFallbackQuestion {
  id: string;
  subjectId: string;
  topicId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

const STOP_WORDS = new Set([
  'uchun', 'bilan', 'orqali', 'haqida', 'bo‘lgan', 'bolgan',
  'uning', 'ular', 'yana', 'juda', 'hamda', 'yoki', 'ammo', 'lekin',
  'shunda', 'bunda', 'qanday', 'qaysi', 'barcha', 'ushbu', 'mazkur',
  'the', 'and', 'that', 'this', 'with', 'from', 'into', 'when', 'where',
  'which', 'what', 'there', 'their', 'about', 'have', 'will', 'were',
  'для', 'это', 'как', 'также', 'который', 'которая', 'которые',
  'через', 'если', 'при', 'или', 'его', 'ее', 'они', 'быть', 'были',
]);

const LABELS: Record<'uz' | 'ru' | 'en', string> = {
  uz: 'Quyidagi jumladagi bo‘sh joyga qaysi atama mos keladi?',
  ru: 'Какой термин подходит для пропуска в следующем предложении?',
  en: 'Which term correctly completes the following sentence?',
};

function normalizeTerm(value: string): string {
  return value.toLocaleLowerCase().replace(/[’‘]/g, "'");
}

/**
 * Deterministic extractive fallback. Every correct answer is copied from the
 * uploaded source; it does not invent facts or depend on an AI provider.
 * It intentionally refuses to create a quiz when the source is too short.
 */
export function generateDocumentQuizFallback(
  sourceText: string,
  input: {
    topicId: string;
    count: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    language: 'uz' | 'ru' | 'en';
  },
): DocumentQuizFallbackQuestion[] {
  const sentences = sourceText
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 700);

  const terms: string[] = [];
  const seen = new Set<string>();
  const tokenPattern = /[\p{L}][\p{L}\p{M}'’‘-]{4,24}/gu;

  for (const sentence of sentences) {
    const words = sentence.match(tokenPattern) || [];
    const candidate = words
      .filter((word) => !STOP_WORDS.has(normalizeTerm(word)))
      .sort((a, b) => b.length - a.length)[0];
    if (!candidate) continue;
    const normalized = normalizeTerm(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    terms.push(candidate);
  }

  if (terms.length < 4) {
    throw new Error('Hujjatda AI’siz test tuzish uchun kamida 4 ta turli atama topilmadi. Aniqroq va mazmunliroq hujjat yuklang.');
  }

  const result: DocumentQuizFallbackQuestion[] = [];
  const usedAnswers = new Set<string>();

  for (const sentence of sentences) {
    if (result.length >= input.count) break;
    const words = sentence.match(tokenPattern) || [];
    const target = words
      .filter((word) => !STOP_WORDS.has(normalizeTerm(word)))
      .sort((a, b) => b.length - a.length)[0];
    if (!target || usedAnswers.has(normalizeTerm(target))) continue;

    const distractors = terms.filter((term) =>
      normalizeTerm(term) !== normalizeTerm(target),
    );
    if (distractors.length < 3) continue;

    const rotation = result.length % distractors.length;
    const options = [
      target,
      ...Array.from({ length: 3 }, (_, index) =>
        distractors[(rotation + index) % distractors.length],
      ),
    ];
    const uniqueOptions = [...new Map(
      options.map((option) => [normalizeTerm(option), option]),
    ).values()];
    if (uniqueOptions.length !== 4) continue;

    const correctAnswer = (result.length * 3) % 4;
    const orderedOptions = [...uniqueOptions];
    const [answer] = orderedOptions.splice(0, 1);
    orderedOptions.splice(correctAnswer, 0, answer);

    const escapedTarget = target.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const questionSentence = sentence.replace(
      new RegExp(escapedTarget, 'i'),
      '________',
    );

    result.push({
      id: input.topicId + '-offline-' + (result.length + 1),
      subjectId: 'document',
      topicId: input.topicId,
      question: LABELS[input.language] + '\n' + questionSentence,
      options: orderedOptions,
      correctAnswer,
      explanation: input.language === 'ru'
        ? 'Ответ взят из исходного предложения документа: ' + sentence
        : input.language === 'en'
          ? 'The answer is taken directly from this source sentence: ' + sentence
          : 'Javob hujjatdagi asl jumladan olindi: ' + sentence,
      difficulty: input.difficulty,
    });
    usedAnswers.add(normalizeTerm(target));
  }

  if (result.length < input.count) {
    throw new Error(
      'Hujjatdan AI’siz aynan ' + input.count +
      ' ta sifatli savol tuzish uchun yetarli mustaqil jumla topilmadi. Hujjatni kengroq shaklda yuklang.',
    );
  }

  return result;
}
