import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DomainsModule } from './domains/domains.module';
import { WebsitesModule } from './websites/websites.module';
import { PagesModule } from './pages/pages.module';
import { ContentModule } from './content/content.module';
import { AiPromptsModule } from './ai-prompts/ai-prompts.module';
import { LeadsModule } from './leads/leads.module';
import { PublicModule } from './public/public.module';
import { AiServiceModule } from './ai-service/ai-service.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL) || 60,
        limit: Number(process.env.THROTTLE_LIMIT) || 100,
      },
    ]),
    // Bull Queue for background jobs
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    DomainsModule,
    WebsitesModule,
    PagesModule,
    ContentModule,
    AiPromptsModule,
    LeadsModule,
    PublicModule,
    AiServiceModule,
    QueueModule,
  ],
})
export class AppModule {}

