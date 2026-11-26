
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { Repository } from 'typeorm';

import { BattleMatch } from '../battle/entities/battle-match.entity';
import { User } from '../users/entities/user.entity';

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

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(BattleMatch)
    private readonly battleRepository: Repository<BattleMatch>,
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
    progress: Awaited<ReturnType<AiTutorService['getStudentProgress']>>,
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
- Keep answers useful, readable and compact by default; expand only when the student asks for detail.
- Format answers in clean, mobile-friendly Markdown so the app can render them as a polished learning interface.
- Use a short descriptive heading only when it improves scanning. Use **bold** for key labels and important values, and concise bullet points for lists.
- For personal progress or statistics requests, start with a heading such as "📊 Sizning statistikangiz", then show each verified metric on its own bullet in the exact format "- **Daraja:** 1". Group related metrics under short headings when useful.
- For statistics, clearly distinguish XP, Rank Points, battle count, wins, losses, draws, win rate and battle points. Do not call XP or ZC cash or cryptocurrency.
- Add a brief interpretation of the numbers and at most two practical next steps. If all values are zero, be encouraging without implying the student has failed.
- For greetings, answer warmly in one or two sentences and invite the student to ask a question; do not produce a long onboarding checklist.
- For lessons, use a clear sequence: **Tushuncha**, **Misol**, and **Xulosa** where appropriate. Use numbered steps for procedures.
- Avoid wide tables, long unbroken lines, excessive headings, decorative emoji overload and repeated generic closing phrases.
- When discussing progress, use only the supplied verified data. Never invent quiz scores, subject accuracy, study streaks or activity history.
- If asked for quiz or subject-level metrics absent from the supplied data, state plainly that those statistics are not currently available in the current app data.
- Mention Premium only when the student explicitly asks about it or it is directly necessary to answer their question. Never add unsolicited sales pitches.
- Do not reveal private information belonging to other users.

Response language: ${languageNames[language]}.

Verified student progress data:
${JSON.stringify(progress)}

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

  async getStudentProgress(userId: string) {
    const [user, matches] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.battleRepository.find({
        where: [
          { playerOneId: userId, status: 'finished' },
          { playerTwoId: userId, status: 'finished' },
        ],
        order: { finishedAt: 'DESC' },
        take: 100,
      }),
    ]);

    const wins = matches.filter((match) => match.winnerId === userId).length;
    const draws = matches.filter((match) => !match.winnerId).length;
    const losses = matches.length - wins - draws;

    return {
      level: user?.level ?? null,
      xp: user?.xp ?? null,
      rankPoints: user?.rankPoints ?? null,
      finishedBattles: matches.length,
      wins,
      losses,
      draws,
      winRate: matches.length ? Math.round((wins / matches.length) * 100) : 0,
      battlePoints: matches.reduce(
        (total, match) => total + (Number(match.scores?.[userId]) || 0),
        0,
      ),
      dataNote: 'Test va fan statistikasi hozircha ushbu API manbasida saqlanmaydi.',
    };
  }
  async sendMessage(
    userId: string,
    message: string,
    language: 'uz' | 'ru' | 'en' = 'uz',
  ) {
    const [history, progress] = await Promise.all([
      this.getPreviousMessages(userId),
      this.getStudentProgress(userId),
    ]);

    const prompt = this.createPrompt(
      message.trim(),
      language,
      history,
      progress,
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
