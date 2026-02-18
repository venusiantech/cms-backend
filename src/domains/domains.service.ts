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
  userDescription?: string;
}

export class DomainsService {
  private aiService: AiService;
  private cloudflareService: CloudflareService;

  constructor() {
    this.aiService = new AiService();
    this.cloudflareService = new CloudflareService();
  }

  // Transform domain response to hide cloudflareZoneId and rename cloudflareStatus
  private transformDomainResponse(domain: any) {
    const { cloudflareZoneId, cloudflareStatus, ...rest } = domain;
    return {
      ...rest,
      nameServersStatus: cloudflareStatus,
    };
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
    let cloudflareResult;
    try {
      cloudflareResult = await this.cloudflareService.addDnsZone(
        dto.domainName
      );
    } catch (error: any) {
      // Pass through specific Cloudflare errors (like invalid domain)
      throw new AppError(error.message, 400);
    }

    // Generate subdomain for the website
    const randomString = Math.random().toString(36).substring(2, 6);
    const subdomain = `${dto.domainName.split('.')[0]}-${randomString}`;

    // Create domain with Cloudflare data AND website record in a transaction
    const domain = await prisma.$transaction(async (tx) => {
      const newDomain = await tx.domain.create({
        data: {
          userId,
          domainName: dto.domainName,
          status: 'PENDING',
          cloudflareZoneId: cloudflareResult?.zoneId || null,
          cloudflareStatus: cloudflareResult?.status || null,
          nameServers: cloudflareResult?.nameServers || [],
        },
      });

      // Create website record with subdomain
      await tx.website.create({
        data: {
          domainId: newDomain.id,
          subdomain: subdomain,
          templateKey: 'modernNews', // Default template
          contactFormEnabled: true,
        },
      });

      // Fetch domain with website relation
      return tx.domain.findUnique({
        where: { id: newDomain.id },
        include: {
          website: true,
        },
      });
    });

    console.log(`✅ Domain created with ID: ${domain!.id}`);
    console.log(`✅ Website record created with subdomain: ${subdomain}`);
    if (cloudflareResult) {
      console.log(`✅ Cloudflare zone created: ${cloudflareResult.zoneId}`);
    }

    return this.transformDomainResponse(domain!);
  }

  async findAll(userId: string, userRole: string) {
    // Super admin can see all domains
    if (userRole === 'SUPER_ADMIN') {
      const domains = await prisma.domain.findMany({
        include: {
          user: {
            select: { id: true, email: true },
          },
          website: {
            include: {
              pages: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return domains.map((d) => this.transformDomainResponse(d));
    }

    // Regular users see only their domains
    const domains = await prisma.domain.findMany({
      where: { userId },
      include: {
        website: {
          include: {
            pages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((d) => this.transformDomainResponse(d));
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

    return this.transformDomainResponse(domain);
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

    const updated = await prisma.domain.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as DomainStatus }),
        ...(dto.selectedMeaning !== undefined && {
          selectedMeaning: dto.selectedMeaning,
        }),
        ...(dto.userDescription !== undefined && {
          userDescription: dto.userDescription,
        }),
      },
    });

    return this.transformDomainResponse(updated);
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
    // Fetch domain directly from DB without transformation to access cloudflareZoneId
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        website: true,
      },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404);
    }

    // Check ownership unless super admin
    if (userRole !== 'SUPER_ADMIN' && domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (!domain.cloudflareZoneId) {
      throw new AppError('No DNS zone configured for this domain', 400);
    }

    console.log(
      `\n🔍 Checking DNS status for domain: ${domain.domainName} (Zone: ${domain.cloudflareZoneId})`
    );

    // Store old status to detect changes
    const oldStatus = domain.cloudflareStatus;

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

      // Debug logging for auto-deployment trigger
      console.log(`🔍 Auto-deploy check: status=${status}, oldStatus=${oldStatus}, hasWebsite=${!!domain.website}`);

      // Auto-deploy workers when DNS becomes active
      if (status === 'active' && oldStatus !== 'active' && domain.website) {
        console.log(
          `\n🎯 DNS became active! Auto-deploying Worker domains and KV mappings...`
        );

        try {
          const deployResult = await this.deployWorkerDomains(
            id,
            userId,
            userRole
          );

          return {
            domainId: domain.id,
            domainName: domain.domainName,
            nameServersStatus: status,
            autoDeployed: true,
            deploymentSuccess: deployResult.success,
          };
        } catch (error: any) {
          console.error(`❌ Auto-deployment failed:`, error.message);
          // Don't fail the status check if deployment fails
          return {
            domainId: domain.id,
            domainName: domain.domainName,
            nameServersStatus: status,
            autoDeployed: false,
            deploymentError: error.message,
          };
        }
      }

      return {
        domainId: domain.id,
        domainName: domain.domainName,
        nameServersStatus: status,
      };
    }

    throw new AppError('Failed to check DNS status', 500);
  }

  async retryCloudflareSetup(id: string, userId: string, userRole: string) {
    // Fetch domain to verify ownership
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404);
    }

    // Verify ownership
    if (userRole !== 'SUPER_ADMIN' && domain.userId !== userId) {
      throw new AppError('Not authorized to manage this domain', 403);
    }

    // Check if already has Cloudflare zone
    if (domain.cloudflareZoneId) {
      throw new AppError('Domain already has Cloudflare zone configured', 400);
    }

    console.log(
      `\n🔄 Retrying Cloudflare setup for: ${domain.domainName}`
    );

    // Attempt to create DNS zone
    let cloudflareResult;
    try {
      cloudflareResult = await this.cloudflareService.addDnsZone(
        domain.domainName
      );
    } catch (error: any) {
      // Pass through specific Cloudflare errors (like invalid domain)
      throw new AppError(error.message, 400);
    }

    if (!cloudflareResult) {
      throw new AppError(
        'Failed to create Cloudflare DNS zone. Please check your Cloudflare credentials or domain format.',
        500
      );
    }

    // Update domain with Cloudflare data
    const updated = await prisma.domain.update({
      where: { id },
      data: {
        cloudflareZoneId: cloudflareResult.zoneId,
        cloudflareStatus: cloudflareResult.status,
        nameServers: cloudflareResult.nameServers,
      },
    });

    console.log(`✅ Cloudflare setup completed for: ${domain.domainName}`);

    return this.transformDomainResponse(updated);
  }

  async deployWorkerDomains(id: string, userId: string, userRole: string) {
    // Fetch domain directly from DB with website relation
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        website: true,
      },
    });

    if (!domain) {
      throw new AppError('Domain not found', 404);
    }

    // Check ownership unless super admin
    if (userRole !== 'SUPER_ADMIN' && domain.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (!domain.cloudflareZoneId) {
      throw new AppError('No DNS zone configured for this domain', 400);
    }

    if (!domain.website) {
      throw new AppError('No website found for this domain', 400);
    }

    const subdomainValue = `${domain.website.subdomain}.jaal.com`;

    console.log(
      `\n🚀 Deploying Cloudflare Workers for domain: ${domain.domainName}`
    );

    // Deploy root domain worker
    const result1 = await this.cloudflareService.addWorkerDomain(
      domain.domainName,
      domain.cloudflareZoneId
    );

    // If worker deployed successfully, add KV mapping
    let kv1 = { success: false, key: domain.domainName };
    if (result1.success) {
      kv1 = await this.cloudflareService.addKvMapping(
        domain.domainName,
        subdomainValue
      );
    }

    // Deploy www subdomain worker
    const result2 = await this.cloudflareService.addWorkerDomain(
      `www.${domain.domainName}`,
      domain.cloudflareZoneId
    );

    // If worker deployed successfully, add KV mapping
    let kv2 = { success: false, key: `www.${domain.domainName}` };
    if (result2.success) {
      kv2 = await this.cloudflareService.addKvMapping(
        `www.${domain.domainName}`,
        subdomainValue
      );
    }

    const allSuccess =
      result1.success && result2.success && kv1.success && kv2.success;

    console.log(
      allSuccess
        ? `✅ Worker domains and KV mappings deployed successfully`
        : `⚠️  Worker domains and KV mappings partially deployed`
    );

    return {
      success: allSuccess,
      deployed: [
        {
          hostname: result1.hostname,
          workerSuccess: result1.success,
          kvSuccess: kv1.success,
        },
        {
          hostname: result2.hostname,
          workerSuccess: result2.success,
          kvSuccess: kv2.success,
        },
      ],
    };
  }
}
