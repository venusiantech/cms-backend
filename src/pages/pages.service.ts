import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  async findByWebsiteId(websiteId: string) {
    return this.prisma.page.findMany({
      where: { websiteId },
      include: {
        sections: {
          include: {
            contentBlocks: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }
}

