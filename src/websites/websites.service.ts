import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { StorageService } from '../storage/storage.service';

interface UpdateAdsDto {
  adsEnabled?: boolean;
  adsApproved?: boolean;
}

interface UpdateContactFormDto {
  contactFormEnabled: boolean;
}

interface UpdateTemplateDto {
  templateKey: string;
}

interface UpdateWebsiteMetadataDto {
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
  metaKeywords?: string;
  metaAuthor?: string;
}

interface UpdateSocialMediaDto {
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
}

interface UpdateContactInfoDto {
  contactEmail?: string;
  contactPhone?: string;
}

export class WebsitesService {
  private storageService = new StorageService();
  /**
   * Get all available templates
   */
  async getAvailableTemplates() {
    return [
      {
        key: 'modernNews',
        name: 'Modern News',
        description: 'A sleek news magazine layout with dynamic blog grid and featured articles',
        previewImage: '/templateA/assets/images/modernNews.png',
        features: [
          'Hero section with featured article',
          'Responsive blog grid layout',
          'SEO-optimized structure',
          'Contact form integration',
          'Dynamic navbar',
        ],
      },
      {
        key: 'templateA',
        name: 'Template A',
        description: 'Professional business template with elegant design and modern features',
        previewImage: '/templateA/assets/images/TemplateA.png',
        features: [
          'Clean and professional layout',
          'Modern design elements',
          'Optimized for business sites',
          'Fully responsive design',
          'Easy to customize',
        ],
      },
    ];
  }

  /**
   * Update ads settings
   */
  async updateAds(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: UpdateAdsDto
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Regular users can only enable ads, not approve them
    // Super admins can do both
    const updateData: any = {};

    if (dto.adsEnabled !== undefined) {
      updateData.adsEnabled = dto.adsEnabled;
    }

    if (dto.adsApproved !== undefined) {
      if (userRole === 'SUPER_ADMIN') {
        updateData.adsApproved = dto.adsApproved;
      } else {
        throw new AppError(
          'Only admins can approve ads',
          403
        );
      }
    }

    return prisma.website.update({
      where: { id: websiteId },
      data: updateData,
    });
  }

  /**
   * Update contact form settings
   */
  async updateContactForm(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: UpdateContactFormDto
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return prisma.website.update({
      where: { id: websiteId },
      data: {
        contactFormEnabled: dto.contactFormEnabled,
      },
    });
  }

  /**
   * Update website template
   */
  async updateTemplate(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: UpdateTemplateDto
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Validate template exists
    const templates = await this.getAvailableTemplates();
    const templateExists = templates.some((t) => t.key === dto.templateKey);

    if (!templateExists) {
      throw new AppError('Invalid template', 400);
    }

    return prisma.website.update({
      where: { id: websiteId },
      data: {
        templateKey: dto.templateKey,
      },
    });
  }

  /**
   * Update website metadata (for social sharing)
   */
  async updateMetadata(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: UpdateWebsiteMetadataDto
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    const updateData: any = {};
    if (dto.metaTitle !== undefined) updateData.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) updateData.metaDescription = dto.metaDescription;
    if (dto.metaImage !== undefined) updateData.metaImage = dto.metaImage;
    if (dto.metaKeywords !== undefined) updateData.metaKeywords = dto.metaKeywords;
    if (dto.metaAuthor !== undefined) updateData.metaAuthor = dto.metaAuthor;

    return prisma.website.update({
      where: { id: websiteId },
      data: updateData,
    });
  }

  /**
   * Update website social media links
   */
  async updateSocialMedia(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: UpdateSocialMediaDto
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    const updateData: any = {};
    if (dto.instagramUrl !== undefined) updateData.instagramUrl = dto.instagramUrl || null;
    if (dto.facebookUrl !== undefined) updateData.facebookUrl = dto.facebookUrl || null;
    if (dto.twitterUrl !== undefined) updateData.twitterUrl = dto.twitterUrl || null;

    return prisma.website.update({
      where: { id: websiteId },
      data: updateData,
    });
  }

  /**
   * Update website contact information
   */
  async updateContactInfo(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: UpdateContactInfoDto
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    const updateData: any = {};
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail || null;
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone || null;

    return prisma.website.update({
      where: { id: websiteId },
      data: updateData,
    });
  }

  /**
   * Update Google Analytics ID
   */
  async updateGoogleAnalytics(
    websiteId: string,
    userId: string,
    userRole: string,
    dto: { googleAnalyticsId?: string }
  ) {
    // Get website with domain to check ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new AppError('Website not found', 404);
    }

    // Check ownership (unless super admin)
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return prisma.website.update({
      where: { id: websiteId },
      data: {
        googleAnalyticsId: dto.googleAnalyticsId || null,
      },
    });
  }

  /**
   * Update logo display mode: "logo_only" | "text_only" | "both"
   */
  async updateLogoDisplayMode(websiteId: string, userId: string, userRole: string, mode: string) {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });
    if (!website) throw new AppError('Website not found', 404);
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }
    return prisma.website.update({
      where: { id: websiteId },
      data: { logoDisplayMode: mode },
    });
  }

  /**
   * Upload website logo: delete old logo from S3 if exists, upload new one, save public URL
   */
  async uploadLogo(
    websiteId: string,
    userId: string,
    userRole: string,
    fileBuffer: Buffer,
    contentType: string
  ) {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) throw new AppError('Website not found', 404);
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Delete old logo from S3 if present
    if (website.websiteLogoKey) {
      try {
        await this.storageService.deleteFromS3(website.websiteLogoKey);
        console.log(`🗑️  Deleted old logo: ${website.websiteLogoKey}`);
      } catch (err) {
        console.warn('⚠️  Could not delete old logo from S3 (continuing):', err);
      }
    }

    // Upload new logo with public-read ACL
    const { publicUrl, key } = await this.storageService.uploadLogoPublic(fileBuffer, contentType);
    console.log(`✅ Logo uploaded: ${publicUrl}`);

    return prisma.website.update({
      where: { id: websiteId },
      data: { websiteLogo: publicUrl, websiteLogoKey: key },
    });
  }

  /**
   * Delete website logo from S3 and clear the DB field
   */
  async deleteLogo(websiteId: string, userId: string, userRole: string) {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) throw new AppError('Website not found', 404);
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (website.websiteLogoKey) {
      try {
        await this.storageService.deleteFromS3(website.websiteLogoKey);
      } catch (err) {
        console.warn('⚠️  Could not delete logo from S3:', err);
      }
    }

    return prisma.website.update({
      where: { id: websiteId },
      data: { websiteLogo: null, websiteLogoKey: null },
    });
  }
}
