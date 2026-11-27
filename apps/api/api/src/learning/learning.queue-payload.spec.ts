import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { LearningService } from './learning.service';

describe('LearningService queued document payload', () => {
  const createService = () => {
    const service = Object.create(LearningService.prototype) as LearningService;
    const createDocumentQuiz = jest.spyOn(service, 'createDocumentQuiz').mockResolvedValue({} as never);
    return { service, createDocumentQuiz };
  };

  it('normalizes metadata and trusts the stored buffer length, not queued client values', async () => {
    const { service, createDocumentQuiz } = createService();
    const fileBuffer = Buffer.from('real-file-bytes');

    await service.generateDocumentQuizForQueue({
      userId: 'user-1',
      fileBuffer,
      payload: {
        fileName: { unsafe: true },
        mimetype: ['application/pdf'],
        size: 1,
        topicId: 'topic-1',
        input: { count: 5, difficulty: 'medium', language: 'uz' },
      },
    });

    expect(createDocumentQuiz).toHaveBeenCalledWith(
      'user-1',
      {
        buffer: fileBuffer,
        originalname: 'document',
        mimetype: 'application/octet-stream',
        size: fileBuffer.length,
      },
      { count: 5, difficulty: 'medium', language: 'uz' },
      { topicId: 'topic-1', _quotaReceipt: undefined },
    );
  });

  it('rejects queued document jobs without a valid topic identifier', async () => {
    const { service, createDocumentQuiz } = createService();

    await expect(service.generateDocumentQuizForQueue({
      userId: 'user-1',
      fileBuffer: Buffer.from('file'),
      payload: { topicId: { value: 'topic-1' } },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(createDocumentQuiz).not.toHaveBeenCalled();
  });
});
