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
              orderBy: { orderIndex: 'desc' }, // latest articles first
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
                  orderBy: { orderIndex: 'desc' }, // latest articles first
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
        metaKeywords: website.metaKeywords,
        metaAuthor: website.metaAuthor,
        instagramUrl: website.instagramUrl,
        facebookUrl: website.facebookUrl,
        twitterUrl: website.twitterUrl,
        contactEmail: website.contactEmail,
        contactPhone: website.contactPhone,
        googleAnalyticsId: website.googleAnalyticsId,
        websiteLogo: website.websiteLogo,
        logoDisplayMode: website.logoDisplayMode,
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
          createdAt: section.createdAt,
          blocks: section.contentBlocks.map((block) => ({
            id: block.id,
            type: block.blockType,
            content: JSON.parse(block.contentJson),
            createdAt: block.createdAt,
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

  async getRobotsTxt(domain: string) {
    if (!domain) {
      throw new AppError('Domain parameter is required', 400);
    }

    console.log(`🤖 Generating robots.txt for: ${domain}`);

    const cleanDomain = domain.replace('.local', '').replace('.jaal.com', '');

    // Try to find website
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
      console.log(`   ❌ Website not found for: ${domain}`);
      // Return default robots.txt even if website not found
      return `# Robots.txt for ${domain}
# Website not configured

User-agent: *
Disallow: /`;
    }

    // Generate dynamic robots.txt based on website
    const siteUrl = `https://${domain}`;
    
    const robotsTxt = `# Robots.txt for ${domain}
# Generated automatically by Domain CMS

User-agent: *
Allow: /

# Sitemaps
Sitemap: ${siteUrl}/sitemap.xml

# Crawl delay (optional)
Crawl-delay: 1

# Disallow admin/private paths (if any)
Disallow: /api/
Disallow: /admin/
`;

    console.log(`✅ Robots.txt generated for: ${domain}`);
    
    return robotsTxt;
  }
}
