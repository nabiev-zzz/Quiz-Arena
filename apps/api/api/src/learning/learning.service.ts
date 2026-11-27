  .where('attempt.userId = :userId', { userId })
      .groupBy('attempt.subjectId')
      .addGroupBy('attempt.subjectName')
      .orderBy('COUNT(attempt.id)', 'DESC')
      .getRawMany();

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);

    const activityRows = await this.attempts
      .createQueryBuilder('attempt')
      .select("TO_CHAR(DATE_TRUNC('day', attempt.completedAt), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(attempt.id)', 'attempts')
      .addSelect('SUM(attempt.correctAnswers)', 'correctAnswers')
      .where('attempt.userId = :userId', { userId })
      .andWhere('attempt.completedAt >= :since', { since })
      .groupBy("DATE_TRUNC('day', attempt.completedAt)")
      .orderBy("DATE_TRUNC('day', attempt.completedAt)", 'ASC')
      .getRawMany();

    const activityMap = new Map(
      activityRows.map((row) => [
        String(row.day),
        {
          attempts: Number(row.attempts) || 0,
          correctAnswers: Number(row.correctAnswers) || 0,
        } as const,
      ]),
    );

    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(since);
      date.setUTCDate(since.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const item = activityMap.get(day);
      return {
        day,
        attempts: item?.attempts ?? 0,
        correctAnswers: item?.correctAnswers ?? 0,
      };
    });

    const totalAttempts = Number(summary?.totalAttempts) || 0;
    const totalQuestions = Number(summary?.totalQuestions) || 0;
    const correctAnswers = Number(summary?.correctAnswers) || 0;

    const recentAttempts = await this.attempts.find({
      where: { userId },
      order: { completedAt: 'DESC' },
      take: 8,
    });

    return {
      totalAttempts,
      totalQuestions,
      correctAnswers,
      accuracy: totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 10000) / 100
        : 0,
      weeklyActivity,
      subjectBreakdown: subjectRows.map((row) => {
        const questions = Number(row.totalQuestions) || 0;
        const correct = Number(row.correctAnswers) || 0;
        return {
          subjectId: String(row.subjectId),
          subjectName: String(row.subjectName),
          attempts: Number(row.attempts) || 0,
          totalQuestions: questions,
          correctAnswers: correct,
          accuracy: questions > 0
            ? Math.round((correct / questions) * 10000) / 100
            : 0,
        };
      }),
      recentAttempts,
    };
  }
}


function splitDocumentIntoChunks(text: string, maxChars: number, overlap: number): string[] {
  const paragraphSeparator = String.fromCharCode(10).repeat(2);
  const paragraphs = text.split(paragraphSeparator).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if (paragraph.length > maxChars) {
      if (current) { chunks.push(current); current = ''; }
      for (let offset = 0; offset < paragraph.length; offset += maxChars - overlap) {
        const piece = paragraph.slice(offset, offset + maxChars).trim();
        if (piece) chunks.push(piece);
      }
      continue;
    }
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = current.slice(-overlap) + paragraphSeparator + paragraph;
    } else current = current ? current + paragraphSeparator + paragraph : paragraph;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

function selectDocumentChunks(chunks: string[], count: number): string[] {
  if (chunks.length <= count) return chunks;
  const selected: string[] = [];
  for (let index = 0; index < count; index += 1) selected.push(chunks[Math.floor(index * (chunks.length - 1) / Math.max(1, count - 1))]);
  return selected;
}

function distributeQuestionCount(count: number, chunks: number): number[] {
  const safeChunks = Math.max(1, chunks);
  const base = Math.floor(count / safeChunks);
  const remainder = count % safeChunks;
  return Array.from({ length: safeChunks }, (_, index) => base + (index < remainder ? 1 : 0));
}

function normalizeDocumentQuestion(value: string): string {
  return value.toLocaleLowerCase().replace(/[.,!?;:()[\]{}]/g, ' ').trim().split(' ').filter(Boolean).slice(0, 20).join(' ');
}

function areNearDuplicateQuestions(left: string, right: string): boolean {
  const tokenize = (value: string) => new Set(value.toLocaleLowerCase().replace(/[.,!?;:()[\]{}]/g, ' ').trim().split(' ').filter((word) => word.length > 2));
  const a = tokenize(left); const b = tokenize(right);
  if (!a.size || !b.size) return false;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  return intersection / (a.size + b.size - intersection) >= 0.82;
}

function detectDocumentLanguage(text: string): 'uz' | 'ru' | 'en' {
  const sample = text.slice(0, 12_000).toLocaleLowerCase();
  if (/[ўқғҳ]/i.test(sample) || ['ta’lim', "ta'lim", 'o‘quv', 'bilim', 'takrorlash', 'mustahkamlash', 'uchun', 'hamda', 'таълим', 'ўқув', 'билим', 'такрорлаш', 'мустаҳкамлаш', 'учун', 'ҳамда'].some((word) => sample.includes(word))) return 'uz';
  const cyrillic = (sample.match(/[а-яё]/gi) || []).length;
  const latin = (sample.match(/[a-z]/gi) || []).length;
  if (cyrillic > latin * 0.15) return 'ru';
  return 'en';
}
