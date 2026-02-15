import { DomainStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { AiService } from '../ai-service/ai.service';
import { CloudflareService } from '../cloudflare-service/cloudflare.service';

interface CreateDomainDto {
  domainName: string;
}

interface UpdateDomainDto {
  status?: string;
  selectedMeaning?: string;
}

export class DomainsService {
  private aiService: AiService;
  private cloudflareService: CloudflareService;

  constructor() {
    this.aiService = new AiService();
    this.cloudflareService = new CloudflareService();
  }

  async create(userId: string, dto: CreateDomainDto) {
    // Check if domain already exists
    const existing = await prisma.domain.findUnique({
      where: { domainName: dto.domainName },
    });

    if (existing) {
      throw new AppError('Domain already registered', 409);
    }

    // Call Cloudflare API to create DNS zone
    console.log(`\n🚀 Creating domain: ${dto.domainName}`);
    const cloudflareResult = await this.cloudflareService.addDnsZone(
      dto.domainName
    );

    // Create domain with Cloudflare data
    const domain = await prisma.domain.create({
      data: {
        userId,
        domainName: dto.domainName,
        status: 'PENDING',
        cloudflareZoneId: cloudflareResult?.zoneId || null,
        cloudflareStatus: cloudflareResult?.status || null,
        nameServers: cloudflareResult?.nameServers || [],
      },
      include: {
        website: true,
      },
    });

    console.log(`✅ Domain created with ID: ${domain.id}`);
    if (cloudflareResult) {
      console.log(`✅ Cloudflare zone created: ${cloudflareResult.zoneId}`);
    }

    return domain;
  }

  async findAll(userId: string, userRole: string) {
    // Super admin can see all domains
    if (userRole === 'SUPER_ADMIN') {
      return prisma.domain.findMany({
        include: {
          user: {
            select: { id: true, email: true },
          },
          website: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Regular users see only their domains
    return prisma.domain.findMany({
      where: { userId },
      include: {
        website: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        website: {
          include: {
            pages: {
              include: {
                sections: {
                  include: {
                    contentBlocks: true,
                  },
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404);
    }

    // Check ownership unless super admin
    if (userRole !== 'SUPER_ADMIN' && domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return domain;
  }

  async findByDomainName(domainName: string) {
    return prisma.domain.findUnique({
      where: { domainName },
      include: {
        website: {
          include: {
            pages: {
              include: {
                sections: {
                  include: {
                    contentBlocks: {
                      include: {
                        aiPrompt: true,
                      },
                    },
                  },
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
      },
    });
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateDomainDto
  ) {
    await this.findOne(id, userId, userRole);

    return prisma.domain.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as DomainStatus }),
        ...(dto.selectedMeaning !== undefined && {
          selectedMeaning: dto.selectedMeaning,
        }),
      },
    });
  }

  async delete(id: string, userId: string, userRole: string) {
    await this.findOne(id, userId, userRole);

    await prisma.domain.delete({
      where: { id },
    });

    return { message: 'Domain deleted successfully' };
  }

  async getSynonyms(id: string, userId: string, userRole: string) {
    const domain = await this.findOne(id, userId, userRole);

    // Extract the main word from domain name (remove TLD and special chars)
    const domainWord = domain.domainName
      .split('.')[0]
      .replace(/[^a-zA-Z]/g, '');

    console.log(
      `\n🔍 Getting synonyms for domain: ${domain.domainName} (word: ${domainWord})`
    );

    // Call AI service to get synonyms (returns object with meaning as key, example as value)
    const synonymsObj = await this.aiService.findSynonyms(domainWord, 5);

    return {
      domainId: domain.id,
      domainName: domain.domainName,
      word: domainWord,
      meanings: synonymsObj, // Object format: { "meaning": "example sentence" }
    };
  }

  async checkDnsStatus(id: string, userId: string, userRole: string) {
    const domain = await this.findOne(id, userId, userRole);

    if (!domain.cloudflareZoneId) {
      throw new AppError('No Cloudflare zone configured for this domain', 400);
    }

    console.log(
      `\n🔍 Checking DNS status for domain: ${domain.domainName} (Zone: ${domain.cloudflareZoneId})`
    );

    // Check status with Cloudflare
    const status = await this.cloudflareService.checkZoneStatus(
      domain.cloudflareZoneId
    );

    if (status) {
      // Update domain status in database
      await prisma.domain.update({
        where: { id },
        data: { cloudflareStatus: status },
      });

      console.log(`✅ DNS status updated: ${status}`);

      return {
        domainId: domain.id,
        domainName: domain.domainName,
        cloudflareStatus: status,
        cloudflareZoneId: domain.cloudflareZoneId,
      };
    }

    throw new AppError('Failed to check DNS status', 500);
  }
}
