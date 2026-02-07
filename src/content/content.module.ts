import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { AiServiceModule } from '../ai-service/ai-service.module';

@Module({
  imports: [AiServiceModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}

