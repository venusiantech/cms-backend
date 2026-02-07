import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/lead.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Public endpoint - creates lead from contact form
   */
  async create(domainName: string, dto: CreateLeadDto) {
    // Find website by domain
    const domain = await this.prisma.domain.findUnique({
      where: { domainName },
      include: { website: true },
    });

    if (!domain || !domain.website) {
      throw new NotFoundException('Website not found');
    }

    return this.prisma.lead.create({
      data: {
        websiteId: domain.website.id,
        name: dto.name,
        company: dto.company,
        email: dto.email,
        message: dto.message,
        leadType: dto.leadType || 'CONTACT',
      },
    });
  }

  /**
   * Get leads for user's websites
   */
  async findByUser(userId: string, userRole: string) {
    // Super admin sees all leads
    if (userRole === 'SUPER_ADMIN') {
      return this.prisma.lead.findMany({
        include: {
          website: {
            include: {
              domain: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Regular users see only their leads
    return this.prisma.lead.findMany({
      where: {
        website: {
          domain: {
            userId,
          },
        },
      },
      include: {
        website: {
          include: {
            domain: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

