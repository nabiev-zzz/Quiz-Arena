option.trim()) ||
      new Set(question.options.map((option) => option.trim().toLocaleLowerCase())).size !== 4 ||
      !Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer > 3 ||
      typeof question.explanation !== 'string' || !question.explanation.trim()) {
      throw new Error(`${index + 1}-savol noto‘g‘ri formatda. Xavfsizlik uchun test ochilmadi.`);
    }
    return question;
  });
  if (questions.length !== expectedCount || (result.questionCount && result.questionCount !== questions.length)) throw new Error('Testdagi savollar soni tanlangan miqdorga mos kelmadi.');
  if (expectedLanguage !== 'auto' && result.language && result.language !== expectedLanguage) throw new Error('Test tanlangan tilda yaratilmagan. Qayta urinib ko‘ring.');
  return { ...result, questions, questionCount: questions.length } as DocumentQuizResult;
}

export async function createDocumentQuiz(
  file: { uri: string; name: string; mimeType?: string | null; file?: Blob },
  options: { count: number; difficulty: Difficulty; language: 'auto' | 'uz' | 'ru' | 'en' },
  controls: { signal?: AbortSignal; onPhase?: (phase: DocumentQuizPhase) => void; onUploadProgress?: (percent: number) => void } = {},
): Promise<DocumentQuizResult> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak.');
  const form = new FormData();
  if (Platform.OS === 'web' && file.file) form.append('file', file.file, file.name);
  else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
  form.append('count', String(options.count));
  form.append('difficulty', options.difficulty);
  form.append('language', options.language);

  controls.onPhase?.('uploading');
  let responseStatus = 0;
  let responseBody = '{}';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const uploaded = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;
        const finish = (callback: () => void) => { if (settled) return; settled = true; controls.signal?.removeEventListener('abort', abort); callback(); };
        const abort = () => { xhr.abort(); finish(() => reject(new Error('Bekor qilindi.'))); };
        xhr.open('POST', `${API_BASE_URL}/api/learning/document-quiz`);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 5 * 60 * 1000;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) controls.onUploadProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        };
        xhr.onload = () => finish(() => resolve({ status: xhr.status, body: xhr.responseText || '{}' }));
        xhr.onerror = () => finish(() => reject(new Error('NETWORK_ERROR')));
        xhr.ontimeout = () => finish(() => reject(new Error('UPLOAD_TIMEOUT')));
        xhr.onabort = () => finish(() => reject(new Error(controls.signal?.aborted ? 'Bekor qilindi.' : 'NETWORK_ERROR')));
        if (controls.signal?.aborted) { abort(); return; }
        controls.signal?.addEventListener('abort', abort, { once: true });
        xhr.send(form);
      });
      responseStatus = uploaded.status;
      responseBody = uploaded.body;
      if (responseStatus !== 429 && responseStatus < 500) break;
    } catch (error) {
      if (controls.signal?.aborted || (error instanceof Error && error.message === 'Bekor qilindi.')) throw new Error('Bekor qilindi.');
      if (attempt === 2) throw new Error(error instanceof Error && error.message === 'UPLOAD_TIMEOUT'
        ? 'Faylni yuklash vaqti tugadi. Internetni tekshirib, qayta urinib ko‘ring.'
        : 'Internet bilan aloqa uzildi. Aloqani tekshirib, qayta urinib ko‘ring.');
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  const data = (() => { try { return JSON.parse(responseBody); } catch { return {}; } })();
  if (!responseStatus) throw new Error('Server bilan bog‘lanib bo‘lmadi. Keyinroq qayta urinib ko‘ring.');
  if (responseStatus < 200 || responseStatus >= 300) {
    const message = typeof data.message === 'string' ? data.message : 'Hujjatdan test yaratib bo‘lmadi.';
    throw new Error(message);
  }
  if (data.status !== 'queued' && data.status !== 'active' && data.status !== 'completed') {
    controls.onPhase?.('done');
    return validateDocumentQuizResult(data, options.count, options.language);
  }
  if (data.status === 'completed' && data.result) {
    controls.onPhase?.('done');
    return validateDocumentQuizResult(data.result, options.count, options.language);
  }
  const jobId = typeof data.jobId === 'string' ? data.jobId : '';
  if (!jobId) throw new Error('Test navbati identifikatori kelmadi. Qayta urinib ko‘ring.');
  controls.signal?.addEventListener('abort', () => {
    void fetch(`${API_BASE_URL}/api/learning/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }, { once: true });

  const deadline = Date.now() + 10 * 60 * 1000;
  let delay = 1800;
  while (Date.now() < deadline) {
    if (controls.signal?.aborted) throw new Error('Bekor qilindi.');
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(new Error('Bekor qilindi.')); };
      const timer = setTimeout(() => { controls.signal?.removeEventListener('abort', onAbort); resolve(); }, delay);
      controls.signal?.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/api/learning/jobs/${encodeURIComponent(jobId)}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: controls.signal,
      });
      if (statusResponse.status === 429 || statusResponse.status >= 500) {
        delay = Math.min(delay * 2, 12_000);
        continue;
      }
      const status = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) throw new Error(typeof status.message === 'string' ? status.message : 'Test holatini tekshirib bo‘lmadi.');
      const step = status.progress?.step;
      if (step === 'reading' || (status.status === 'active' && !step)) controls.onPhase?.('reading');
      else if (step === 'generating') controls.onPhase?.('generating');
      if (status.status === 'completed' && status.result) {
        controls.onPhase?.('done');
        return validateDocumentQuizResult(status.result, options.count, options.language);
      }
      if (status.status === 'failed') throw new Error(typeof status.error === 'string' ? status.error : 'AI test yaratishda xatolik yuz berdi.');
      delay = 1800;
    } catch (error) {
      if (controls.signal?.aborted) throw new Error('Bekor qilindi.');
      if (error instanceof Error && !/network|fetch|timeout/i.test(error.message)) throw error;
      delay = Math.min(delay * 2, 12_000);
    }
  }
  throw new Error('Test yaratish uzoq davom etdi. Fayl saqlangan, qayta urinib ko‘rishingiz mumkin.');
}

export interface SmartPracticeResult {
  title: string;
  topicId: string;
  personalized: boolean;
  questionCount: number;
  questions: DocumentQuizQuestion[];
}

export const createSmartPractice = async (count: number, language: 'uz' | 'ru' | 'en') => {
  const result = await learningRequest<SmartPracticeResult & { status?: 'queued' | 'active' | 'completed'; jobId?: string; result?: SmartPracticeResult }>(
    '/api/learning/smart-practice',
    { method: 'POST', body: JSON.stringify({ count, language }) },
  );
  if (result.status === 'queued' || result.status === 'active') {
    return waitForLearningJob<SmartPracticeResult>(String(result.jobId));
  }
  if (result.status === 'completed' && result.result) return result.result as SmartPracticeResult;
  return result;
};
