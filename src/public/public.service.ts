import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { DomainsService } from '../domains/domains.service';

interface ContactFormDto {
  domain: string;
  name: string;
  email: string;
  company?: string;
  message: string;
}

export class PublicService {
  private domainsService: DomainsService;

  constructor() {
    this.domainsService = new DomainsService();
  }

  async getSiteByDomain(domain: string) {
    if (!domain) {
      throw new AppError('Domain parameter is required', 400);
    }

    console.log(`🔍 Looking up website for: ${domain}`);

    // Remove platform suffixes
    let cleanDomain = domain.replace('.local', '').replace('.jaal.com', '');
    console.log(`   Cleaned domain: ${cleanDomain}`);

    // First, try to find by subdomain
    let website = await prisma.website.findFirst({
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

    // If not found, try by custom domain
    if (!website) {
      console.log(`   Not found by subdomain, trying custom domain...`);

      let domainData = await this.domainsService.findByDomainName(cleanDomain);

      if (!domainData && !cleanDomain.includes('.')) {
        console.log(`   Trying with .com extension...`);
        domainData = await this.domainsService.findByDomainName(`${cleanDomain}.com`);
      }

      if (domainData && domainData.website) {
        website = await prisma.website.findUnique({
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
      throw new AppError(`Website not found for domain: ${domain}`, 404);
    }

    console.log(`   ✅ Website found! ID: ${website.id}`);

    return {
      domain: {
        id: website.domain.id,
        name: website.domain.domainName,
        status: website.domain.status,
        subdomain: website.subdomain,
      },
      website: {
        id: website.id,
        templateKey: website.templateKey,
        adsEnabled: website.adsEnabled,
        adsApproved: website.adsApproved,
        contactFormEnabled: website.contactFormEnabled,
        metaTitle: website.metaTitle,
        metaDescription: website.metaDescription,
        metaImage: website.metaImage,
      },
      pages: website.pages.map((page) => ({
        id: page.id,
        slug: page.slug,
        seo: {
          title: page.seoTitle,
          description: page.seoDescription,
        },
        sections: page.sections.map((section) => ({
          id: section.id,
          type: section.sectionType,
          order: section.orderIndex,
          blocks: section.contentBlocks.map((block) => ({
            id: block.id,
            type: block.blockType,
            content: JSON.parse(block.contentJson),
          })),
        })),
      })),
    };
  }

  async submitContactForm(dto: ContactFormDto) {
    const { domain, name, email, company, message } = dto;

    console.log(`📧 Contact form submission from: ${domain}`);

    const cleanDomain = domain.replace('.local', '').replace('.jaal.com', '');

    let website = await prisma.website.findFirst({
      where: { subdomain: cleanDomain },
      include: { domain: true },
    });

    if (!website) {
      let domainData = await this.domainsService.findByDomainName(cleanDomain);

      if (!domainData && !cleanDomain.includes('.')) {
        domainData = await this.domainsService.findByDomainName(`${cleanDomain}.com`);
      }

      if (domainData && domainData.website) {
        website = await prisma.website.findUnique({
          where: { id: domainData.website.id },
          include: { domain: true },
        });
      }
    }

    if (!website) {
      throw new AppError(`Website not found for domain: ${domain}`, 404);
    }

    const lead = await prisma.lead.create({
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
