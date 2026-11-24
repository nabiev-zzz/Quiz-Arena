
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

type QuestionData = {
  subjectId: string;
  topicId: string;
  subjectName?: string;
  topicName?: string;
  topicDescription?: string;
  count: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  language: 'uz' | 'ru' | 'en';
};

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigService) {}

  private createPrompt(data: QuestionData): string {
    const languages = {
      uz: 'Uzbek',
      ru: 'Russian',
      en: 'English',
    };

    return `
You are a professional educational quiz generator.

Generate EXACTLY ${data.count} different multiple-choice questions.

Subject: ${data.subjectName || data.subjectId} (ID: ${data.subjectId})
Topic: ${data.topicName || data.topicId} (ID: ${data.topicId})
Topic description: ${data.topicDescription || 'Use the exact topic name as the scope.'}
Difficulty: ${data.difficulty}
Language: ${languages[data.language]}

STRICT RULES:
1. The questions array MUST contain exactly ${data.count} questions.
2. Every question MUST have exactly 4 non-empty answer options.
3. Only one answer must be correct.
4. correctAnswer must be an integer from 0 to 3.
5. Every question must have a non-empty explanation.
6. Every question must directly test the named subject and topic; do not drift into neighboring topics.
7. Use the topic description as the learning boundary and make questions educationally accurate and unambiguous.
8. Do not repeat questions.
9. Do not add comments or Markdown.
10. Return one valid JSON object only.
11. Do not return fewer or more than ${data.count} questions.

Required JSON structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Explanation"
    }
  ]
}

Before returning, verify that the questions array contains exactly ${data.count} items.
`;
  }

  private parseJson(content: string): any {
    let cleaned = content.trim();

    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('AI javobida JSON topilmadi');
      }

      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
  }

  private validateQuestions(content: string, data: QuestionData) {
    const result = this.parseJson(content);

    if (
      !result ||
      !Array.isArray(result.questions) ||
      result.questions.length !== data.count
    ) {
      const actualCount = Array.isArray(result?.questions)
        ? result.questions.length
        : 0;

      throw new Error(
        `Savollar soni noto'g'ri. Kutilgan: ${data.count}, olingan: ${actualCount}`,
      );
    }

    const questions = result.questions.map((q: any, index: number) => {
      if (
        !q ||
        typeof q.question !== 'string' ||
        !q.question.trim() ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some(
          (option: unknown) =>
            typeof option !== 'string' || !option.trim(),
        ) ||
        !Number.isInteger(q.correctAnswer) ||
        q.correctAnswer < 0 ||
        q.correctAnswer > 3 ||
        typeof q.explanation !== 'string' ||
        !q.explanation.trim()
      ) {
        throw new Error(`${index + 1}-savol formati noto'g'ri`);
      }

      return {
        id: `${data.topicId}-${Date.now()}-${index}`,
        subjectId: data.subjectId,
        topicId: data.topicId,
        question: q.question.trim(),
        options: q.options.map((option: string) => option.trim()),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation.trim(),
        difficulty: data.difficulty,
      };
    });

    const unique = new Set(
      questions.map((q: { question: string }) =>
        q.question.toLowerCase().trim(),
      ),
    );

    if (unique.size !== questions.length) {
      throw new Error('Takroriy savollar aniqlandi');
    }

    return questions;
  }

  private async generateWithGroq(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      throw new Error('GROQ_API_KEY sozlanmagan');
    }

    const groq = new Groq({ apiKey });
    const model =
      this.configService.get<string>('GROQ_MODEL') ||
      'openai/gpt-oss-120b';

    const response = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise educational quiz generator. Follow the requested question count exactly. Return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Groq bo'sh javob qaytardi");
    }

    return content;
  }

  private async generateWithGemini(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY sozlanmagan');
    }

    const ai = new GoogleGenAI({ apiKey });
    const model =
      this.configService.get<string>('GEMINI_MODEL') ||
      'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    if (!response.text) {
      throw new Error("Gemini bo'sh javob qaytardi");
    }

    return response.text;
  }

  async generateQuestions(data: QuestionData) {
    const basePrompt = this.createPrompt(data);

    const providers = [
      {
        name: 'Groq',
        generate: (prompt: string) => this.generateWithGroq(prompt),
      },
      {
        name: 'Gemini',
        generate: (prompt: string) => this.generateWithGemini(prompt),
      },
    ];

    let hadInvalidResponse = false;
    let lastError: unknown;

    for (const provider of providers) {
      console.log(`AI provayder tekshirilmoqda: ${provider.name}`);

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`${provider.name}: urinish ${attempt}/2`);

          let prompt = basePrompt;

          if (attempt === 2) {
            prompt += `

IMPORTANT CORRECTION:
Your previous response did not pass validation.
Return a completely new JSON response.
The questions array MUST contain exactly ${data.count} questions.
Every question must have exactly 4 options.
Do not repeat questions.
Return valid JSON only.
`;
          }

          const content = await provider.generate(prompt);
          const questions = this.validateQuestions(content, data);

          console.log(
            `${provider.name}: ${questions.length} ta savol yaratildi.`,
          );

          // MUHIM TUZATISH:
          // Savollar tekshiruvdan o'tgach, darhol natijani qaytaramiz.
          return questions;

        } catch (error) {
          lastError = error;

          if (
            error instanceof SyntaxError ||
            (error instanceof Error &&
              (
                error.message.includes('Savollar soni') ||
                error.message.includes('savol formati') ||
                error.message.includes('Takroriy savollar') ||
                error.message.includes('JSON')
              ))
          ) {
            hadInvalidResponse = true;
          }

          console.error(
            `${provider.name}: ${attempt}-urinish muvaffaqiyatsiz.`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      console.log(
        `${provider.name} ishlamadi. Keyingi AI provayderga o'tilmoqda.`,
      );
    }

    console.error('Barcha AI provayderlarida xatolik:', lastError);

    if (hadInvalidResponse) {
      throw new InternalServerErrorException(
        "AI savollarni kerakli formatda yarata olmadi. Qayta urinib ko'ring.",
      );
    }

    throw new ServiceUnavailableException(
      'AI xizmatlari vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.',
    );
  }
}
