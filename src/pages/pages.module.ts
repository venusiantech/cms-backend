import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';

@Module({
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}

