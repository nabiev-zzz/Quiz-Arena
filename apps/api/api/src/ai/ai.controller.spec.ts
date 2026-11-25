import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiTutorService } from './ai-tutor.service';
import { AiGenerationQueueService } from './queue/ai-generation-queue.service';

describe('AiController', () => {
  let controller: AiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: {
            generateQuestions: jest.fn(),
          },
        },
        {
          provide: AiTutorService,
          useValue: {
            enqueueMessage: jest.fn(),
            getHistory: jest.fn(),
          },
        },
        { provide: AiGenerationQueueService, useValue: { enqueue: jest.fn(), getStatus: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});