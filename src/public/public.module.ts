import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule],
  controllers: [PublicController],
})
export class PublicModule {}

