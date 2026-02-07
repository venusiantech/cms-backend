import { Controller, Get, Post, Body, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DomainsService } from '../domains/domains.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PUBLIC API - No authentication required
 * This is the critical endpoint that enables domain-based rendering
 * Supports both custom domains (chocolate.com) and subdomains (chocolate-xyz.yourdomain.com)
 */
@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private domainsService: DomainsService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /api/public/site?domain=example.com
   * 
   * Returns complete website data for a domain
   * Used by the Next.js frontend to render sites dynamically
   * 
   * Supports two types of domains:
   * 1. Custom domain: chocolate.com (user's own domain via CNAME)
   * 2. Subdomain: chocolate-xyz.yourdomain.com (auto-generated)
   */
  @Get('site')
  @ApiOperation({ summary: 'Get website data by domain or subdomain (Public)' })
  @ApiQuery({ name: 'domain', example: 'example.com' })
  async getSiteByDomain(@Query('domain') domain: string) {
    if (!domain) {
      throw new NotFoundException('Domain parameter is required');
    }

    console.log(`🔍 Looking up website for: ${domain}`);

    // Remove .local suffix for local testing
    const cleanDomain = domain.replace('.local', '');
    console.log(`   Cleaned domain: ${cleanDomain}`);

    // First, try to find by subdomain (chocolate-xyz or chocolate-xyz.local)
    let website = await this.prisma.website.findFirst({
      where: { subdomain: cleanDomain },
      include: {
        domain: true,
        pages: {
          orderBy: { slug: 'asc' },
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                contentBlocks: {
                  orderBy: { id: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    // If not found, try to find by custom domain (chocolate.com)
    if (!website) {
      console.log(`   Not found by subdomain, trying custom domain...`);
      const domainData = await this.domainsService.findByDomainName(cleanDomain);
      
      if (domainData && domainData.website) {
        website = await this.prisma.website.findUnique({
          where: { id: domainData.website.id },
          include: {
            domain: true,
            pages: {
              orderBy: { slug: 'asc' },
              include: {
                sections: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    contentBlocks: {
                      orderBy: { id: 'asc' },
                    },
                  },
                },
              },
            },
          },
        });
      }
    }

    if (!website) {
      console.log(`   ❌ Website not found for: ${domain}`);
      throw new NotFoundException(`Website not found for domain: ${domain}`);
    }

    console.log(`   ✅ Website found! ID: ${website.id}`);
    console.log(`   📍 Custom domain: ${website.domain.domainName}`);
    console.log(`   🌐 Subdomain: ${website.subdomain}`);

    // Return structured data for frontend rendering
    return {
      domain: {
        id: website.domain.id,
        name: website.domain.domainName,
        status: website.domain.status,
        subdomain: website.subdomain, // Include subdomain in response
      },
      website: {
        id: website.id,
        templateKey: website.templateKey,
        adsEnabled: website.adsEnabled,
        adsApproved: website.adsApproved,
        contactFormEnabled: website.contactFormEnabled,
      },
      pages: website.pages.map(page => ({
        id: page.id,
        slug: page.slug,
        seo: {
          title: page.seoTitle,
          description: page.seoDescription,
        },
        sections: page.sections.map(section => ({
          id: section.id,
          type: section.sectionType,
          order: section.orderIndex,
          blocks: section.contentBlocks.map(block => ({
            id: block.id,
            type: block.blockType,
            content: JSON.parse(block.contentJson),
          })),
        })),
      })),
    };
  }

  /**
   * POST /api/public/contact
   * 
   * Submit contact form from any generated website
   * Public endpoint - no authentication required
   */
  @Post('contact')
  @ApiOperation({ summary: 'Submit contact form (Public)' })
  async submitContactForm(
    @Body() body: { domain: string; name: string; email: string; company?: string; message: string },
  ) {
    const { domain, name, email, company, message } = body;

    console.log(`📧 Contact form submission from: ${domain}`);
    console.log(`   Name: ${name}`);
    console.log(`   Email: ${email}`);

    // Validate required fields
    if (!domain || !name || !email || !message) {
      throw new NotFoundException('Missing required fields: domain, name, email, message');
    }

    // Find website by domain or subdomain
    const cleanDomain = domain.replace('.local', '');
    
    let website = await this.prisma.website.findFirst({
      where: { subdomain: cleanDomain },
      include: { domain: true },
    });

    if (!website) {
      const domainData = await this.domainsService.findByDomainName(cleanDomain);
      if (domainData && domainData.website) {
        website = await this.prisma.website.findUnique({
          where: { id: domainData.website.id },
          include: { domain: true },
        });
      }
    }

    if (!website) {
      throw new NotFoundException(`Website not found for domain: ${domain}`);
    }

    // Create lead entry
    const lead = await this.prisma.lead.create({
      data: {
        websiteId: website.id,
        name,
        email,
        company: company || null,
        message,
      },
    });

    console.log(`✅ Lead created: ${lead.id}`);

    return {
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      leadId: lead.id,
    };
  }
}

