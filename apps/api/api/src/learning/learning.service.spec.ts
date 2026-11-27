 tier: 'free', entitlements: getPlanEntitlements(null) });
    const large = Buffer.alloc(6 * 1024 * 1024, 65);
    await expect(service.createDocumentQuiz('user-1', { buffer: large, originalname: 'x.txt', mimetype: 'text/plain', size: large.length }, { count: '5' })).rejects.toThrow('5 MB');
    expect(featureUsageService.consume).not.toHaveBeenCalled();
  });

  it('fails gracefully when AI cannot produce a complete source-grounded quiz', async () => {
    aiService.generateDocumentQuestions.mockRejectedValue(new Error('AI unavailable'));
    await expect(service.createDocumentQuiz('user-1', { buffer: Buffer.from(sourceText), originalname: 'lesson.txt', mimetype: 'text/plain', size: Buffer.byteLength(sourceText) }, { count: '5' }, { topicId: 'doc-error', _quotaReceipt: true })).rejects.toThrow();
  });
});

describe('LearningService shared Redis question cache', () => {
  it('returns a cached question pool without opening a database transaction or calling AI', async () => {
    const cachedQuestions = Array.from({ length: 20 }, (_, index) => ({
      id: 'cached-' + index,
      subjectId: 'algebra',
      topicId: 'equations',
      question: 'Cached question ' + index,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: index % 4,
      explanation: 'Cached explanation',
      difficulty: 'medium',
    }));
    const cache = { get: jest.fn().mockResolvedValue(cachedQuestions), set: jest.fn() };
    const topicsRepository = {
      findOne: jest.fn().mockResolvedValue({
        subjectId: 'algebra',
        topicId: 'equations',
        subjectName: 'Algebra',
        topicName: 'Tenglamalar',
        description: 'Tenglamalar',
        isActive: true,
      }),
    };
    const dataSource = { transaction: jest.fn() };
    const ai = { generateQuestions: jest.fn() };
    const cachedService = new LearningService(
      {} as never,
      topicsRepository as never,
      {} as never,
      dataSource as never,
      ai as never,
      {} as never,
      {} as never,
      cache as never,
    );

    const result = await cachedService.getTopicQuestions({
      subjectId: 'algebra',
      topicId: 'equations',
      count: 10,
      difficulty: 'medium',
      language: 'uz',
    }) as any;

    expect(result.questions).toHaveLength(10);
    expect(result.source).toBe('database');
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(ai.generateQuestions).not.toHaveBeenCalled();
  });
});
