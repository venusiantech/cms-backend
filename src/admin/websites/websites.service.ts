import prisma from '../../config/prisma';
import { AppError } from '../../middleware/error.middleware';

export class AdminWebsitesService {
  async findAll() {
    return prisma.website.findMany({
      include: {
        domain: {
          include: {
            user: { select: { id: true, email: true, role: true } },
          },
        },
        pages: { select: { id: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(websiteId: string) {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        domain: {
          include: {
            user: { select: { id: true, email: true, role: true } },
          },
        },
        pages: {
          include: {
            sections: {
              include: { contentBlocks: true },
              orderBy: { orderIndex: 'desc' },
            },
          },
        },
      },
    });

    if (!website) throw new AppError('Website not found', 404);
    return website;
  }

  async updateSettings(
    websiteId: string,
    dto: {
      templateKey?: string;
      adsEnabled?: boolean;
      adsApproved?: boolean;
      contactFormEnabled?: boolean;
      metaTitle?: string;
      metaDescription?: string;
      metaImage?: string;
      metaKeywords?: string;
      metaAuthor?: string;
      instagramUrl?: string;
      facebookUrl?: string;
      twitterUrl?: string;
      contactEmail?: string;
      contactPhone?: string;
      googleAnalyticsId?: string;
      logoDisplayMode?: string;
    }
  ) {
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw new AppError('Website not found', 404);

    return prisma.website.update({
      where: { id: websiteId },
      data: {
        ...(dto.templateKey !== undefined && { templateKey: dto.templateKey }),
        ...(dto.adsEnabled !== undefined && { adsEnabled: dto.adsEnabled }),
        ...(dto.adsApproved !== undefined && { adsApproved: dto.adsApproved }),
        ...(dto.contactFormEnabled !== undefined && { contactFormEnabled: dto.contactFormEnabled }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle || null }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription || null }),
        ...(dto.metaImage !== undefined && { metaImage: dto.metaImage || null }),
        ...(dto.metaKeywords !== undefined && { metaKeywords: dto.metaKeywords || null }),
        ...(dto.metaAuthor !== undefined && { metaAuthor: dto.metaAuthor || null }),
        ...(dto.instagramUrl !== undefined && { instagramUrl: dto.instagramUrl || null }),
        ...(dto.facebookUrl !== undefined && { facebookUrl: dto.facebookUrl || null }),
        ...(dto.twitterUrl !== undefined && { twitterUrl: dto.twitterUrl || null }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail || null }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone || null }),
        ...(dto.googleAnalyticsId !== undefined && { googleAnalyticsId: dto.googleAnalyticsId || null }),
        ...(dto.logoDisplayMode !== undefined && { logoDisplayMode: dto.logoDisplayMode }),
      },
      include: {
        domain: { include: { user: { select: { id: true, email: true } } } },
      },
    });
  }

  async approveAds(websiteId: string, approved: boolean) {
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw new AppError('Website not found', 404);

    return prisma.website.update({
      where: { id: websiteId },
      data: { adsApproved: approved },
    });
  }
}
