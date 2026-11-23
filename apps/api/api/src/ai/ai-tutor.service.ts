
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { Repository } from 'typeorm';

import {
  AiTutorMessage,
  AiTutorMessageRole,
} from './entities/ai-tutor-message.entity';

@Injectable()
export class AiTutorService {
  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(AiTutorMessage)
    private readonly messageRepository: Repository<AiTutorMessage>,
  ) {}

  private async getPreviousMessages(userId: string) {
    const messages = await this.messageRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 12,
    });

    return messages.reverse();
  }

  private createPrompt(
    message: string,
    language: 'uz' | 'ru' | 'en',
    history: AiTutorMessage[],
  ): string {
    const languageNames = {
      uz: 'Uzbek',
      ru: 'Russian',
      en: 'English',
    };

    const conversation = history.map((item) => ({
      role: item.role,
      content: item.content,
    }));

    return `
You are QUIZ ARENA's personal AI Tutor.

Your task:
- Teach the student clearly and patiently.
- Explain concepts step by step.
- Give examples when useful.
- Help the student understand mistakes.
- Encourage learning and critical thinking.
- Do not invent facts.
- If you are uncertain, say so honestly.
- Keep answers useful and easy to understand.
- Do not reveal private information belonging to other users.

Response language: ${languageNames[language]}.

Previous conversation:
${JSON.stringify(conversation)}

Student's new message:
${message}

Answer the student's new message in the requested language.
`;
  }

  private async askGroq(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      throw new Error('Groq API kaliti sozlanmagan');
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
            'You are a helpful, accurate and patient educational AI tutor.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const answer = response.choices[0]?.message?.content;

    if (!answer || !answer.trim()) {
      throw new Error('Groq bo‘sh javob qaytardi');
    }

    return answer.trim();
  }

  private async askGemini(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('Gemini API kaliti sozlanmagan');
    }

    const ai = new GoogleGenAI({ apiKey });

    const model =
      this.configService.get<string>('GEMINI_MODEL') ||
      'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.5,
      },
    });

    if (!response.text || !response.text.trim()) {
      throw new Error('Gemini bo‘sh javob qaytardi');
    }

    return response.text.trim();
  }

  private async generateAnswer(prompt: string): Promise<string> {
    try {
      console.log('AI Tutor: asosiy provayder Groq');

      return await this.askGroq(prompt);
    } catch (groqError) {
      console.error('AI Tutor: Groq ishlamadi, Gemini sinab ko‘riladi.');

      try {
        return await this.askGemini(prompt);
      } catch (geminiError) {
        console.error('AI Tutor Groq xatosi:', groqError);
        console.error('AI Tutor Gemini xatosi:', geminiError);

        throw new ServiceUnavailableException(
          'AI Ustoz hozircha javob bera olmayapti. Keyinroq urinib ko‘ring.',
        );
      }
    }
  }

  async sendMessage(
    userId: string,
    message: string,
    language: 'uz' | 'ru' | 'en' = 'uz',
  ) {
    const history = await this.getPreviousMessages(userId);

    const prompt = this.createPrompt(
      message.trim(),
      language,
      history,
    );

    const answer = await this.generateAnswer(prompt);

    const userMessage = this.messageRepository.create({
      userId,
      role: 'user' as AiTutorMessageRole,
      content: message.trim(),
    });

    const assistantMessage = this.messageRepository.create({
      userId,
      role: 'assistant' as AiTutorMessageRole,
      content: answer,
    });

    const savedMessages = await this.messageRepository.save([
      userMessage,
      assistantMessage,
    ]);

    return {
      userMessage: savedMessages[0],
      assistantMessage: savedMessages[1],
    };
  }

  async getHistory(userId: string) {
    const messages = await this.messageRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    return {
      messages,
    };
  }
}
