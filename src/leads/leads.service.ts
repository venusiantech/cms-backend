import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';

interface CreateLeadDto {
  name: string;
  email: string;
  company?: string;
  message: string;
  leadType?: string;
}

export class LeadsService {
  /**
   * Public endpoint - creates lead from contact form
   */
  async create(domainName: string, dto: CreateLeadDto) {
    // Find website by domain
    const domain = await prisma.domain.findUnique({
      where: { domainName },
      include: { website: true },
    });

    if (!domain || !domain.website) {
      throw new AppError('Website not found', 404);
    }

    return prisma.lead.create({
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
      return prisma.lead.findMany({
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
    return prisma.lead.findMany({
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
