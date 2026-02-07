import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WebsiteQueueService } from './website-queue.service';
import { WebsiteProcessor } from './website.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { AiService } from '../ai-service/ai.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'website-generation',
    }),
    PrismaModule,
  ],
  providers: [WebsiteQueueService, WebsiteProcessor, AiService],
  exports: [WebsiteQueueService],
})
export class QueueModule {}


