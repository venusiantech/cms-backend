import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}

