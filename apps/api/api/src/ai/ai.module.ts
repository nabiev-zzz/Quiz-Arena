import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiService } from './ai.service';
import { AiTutorService } from './ai-tutor.service';
import { AiController } from './ai.controller';
import { AiTutorMessage } from './entities/ai-tutor-message.entity';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiTutorMessage]),
    AuthModule,
  ],
  providers: [
    AiService,
    AiTutorService,
  ],
  controllers: [
    AiController,
  ],
  exports: [AiService],
})
export class AiModule {}
