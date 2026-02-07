import { Module } from '@nestjs/common';
import { WebsitesService } from './websites.service';
import { WebsitesController } from './websites.controller';
import { DomainsModule } from '../domains/domains.module';
import { AiServiceModule } from '../ai-service/ai-service.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [DomainsModule, AiServiceModule, QueueModule],
  controllers: [WebsitesController],
  providers: [WebsitesService],
  exports: [WebsitesService],
})
export class WebsitesModule {}

