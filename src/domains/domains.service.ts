import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-service/ai.service';
import { CreateDomainDto, UpdateDomainDto } from './dto/domain.dto';
import { DomainStatus } from '@prisma/client';

@Injectable()
export class DomainsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async create(userId: string, dto: CreateDomainDto) {
    // Check if domain already exists
    const existing = await this.prisma.domain.findUnique({
      where: { domainName: dto.domainName },
    });

    if (existing) {
      throw new ConflictException('Domain already registered');
    }

    return this.prisma.domain.create({
      data: {
        userId,
        domainName: dto.domainName,
        status: 'PENDING',
      },
      include: {
        website: true,
      },
    });
  }

  async findAll(userId: string, userRole: string) {
    // Super admin can see all domains
    if (userRole === 'SUPER_ADMIN') {
      return this.prisma.domain.findMany({
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
    return this.prisma.domain.findMany({
      where: { userId },
      include: {
        website: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const domain = await this.prisma.domain.findUnique({
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
      throw new NotFoundException('Domain not found');
    }

    // Check ownership unless super admin
    if (userRole !== 'SUPER_ADMIN' && domain.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return domain;
  }

  async findByDomainName(domainName: string) {
    return this.prisma.domain.findUnique({
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

  async update(id: string, userId: string, userRole: string, dto: UpdateDomainDto) {
    const domain = await this.findOne(id, userId, userRole);

    return this.prisma.domain.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as DomainStatus }),
        ...(dto.selectedMeaning !== undefined && { selectedMeaning: dto.selectedMeaning }),
      },
    });
  }

  async delete(id: string, userId: string, userRole: string) {
    const domain = await this.findOne(id, userId, userRole);

    await this.prisma.domain.delete({
      where: { id },
    });

    return { message: 'Domain deleted successfully' };
  }

  async getSynonyms(id: string, userId: string, userRole: string) {
    const domain = await this.findOne(id, userId, userRole);
    
    // Extract the main word from domain name (remove TLD and special chars)
    const domainWord = domain.domainName.split('.')[0].replace(/[^a-zA-Z]/g, '');
    
    console.log(`\n🔍 Getting synonyms for domain: ${domain.domainName} (word: ${domainWord})`);
    
    // Call AI service to get synonyms
    const meanings = await this.aiService.findSynonyms(domainWord, 5);
    
    return {
      domainId: domain.id,
      domainName: domain.domainName,
      word: domainWord,
      meanings,
    };
  }
}

