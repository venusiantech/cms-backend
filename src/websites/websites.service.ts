import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-service/ai.service';
import { GenerateWebsiteDto, UpdateAdsDto, UpdateContactFormDto } from './dto/website.dto';

@Injectable()
export class WebsitesService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * Generate entire website with AI content
   */
  async generate(userId: string, dto: GenerateWebsiteDto) {
    console.log('\n🚀 === WEBSITE GENERATION STARTED ===');
    console.log(`📋 User ID: ${userId}`);
    console.log(`📋 Domain ID: ${dto.domainId}`);
    console.log(`📋 Template: ${dto.templateKey}`);

    // Verify domain ownership
    const domain = await this.prisma.domain.findUnique({
      where: { id: dto.domainId },
    });

    if (!domain || domain.userId !== userId) {
      console.log('❌ Access denied - Domain not found or user mismatch');
      throw new ForbiddenException('Access denied');
    }

    console.log(`✅ Domain found: ${domain.domainName}`);

    // Check if website already exists
    const existing = await this.prisma.website.findUnique({
      where: { domainId: dto.domainId },
    });

    if (existing) {
      console.log('❌ Website already exists for this domain');
      throw new ForbiddenException('Website already exists for this domain');
    }

    // Fetch AI prompts for template
    console.log(`🔍 Fetching AI prompts for template: ${dto.templateKey}`);
    const prompts = await this.prisma.aiPrompt.findMany({
      where: { templateKey: dto.templateKey },
    });

    console.log(`📊 Found ${prompts.length} AI prompts`);
    if (prompts.length > 0) {
      prompts.forEach(p => {
        console.log(`   - ${p.promptKey} (${p.promptType})`);
      });
    } else {
      console.log('⚠️  WARNING: No AI prompts found! Using fallback content generation.');
    }

    // Generate subdomain from domain name
    // Example: chocolate.com -> chocolate.yourdomain.com
    const subdomain = this.generateSubdomain(domain.domainName);
    console.log(`🌐 Generated subdomain: ${subdomain}`);

    // Create website
    console.log('📦 Creating website record...');
    const website = await this.prisma.website.create({
      data: {
        domainId: dto.domainId,
        subdomain: subdomain,
        templateKey: dto.templateKey,
        adsEnabled: false,
        adsApproved: false,
        contactFormEnabled: dto.contactFormEnabled !== undefined ? dto.contactFormEnabled : true,
      },
    });
    console.log(`✅ Website created: ${website.id}`);

    // Create only Home page - no About or Contact pages
    console.log('📄 Creating Home page...');
    const homePage = await this.createPage(website.id, '/', 'Home');
    console.log(`✅ Created Home page`);

    // Generate content for Home page with initial 3 blogs
    console.log('🎨 Generating content for HOME page...');
    console.log(`\n📄 Processing page: ${homePage.slug}`);
    await this.generatePageContent(homePage.id, dto.templateKey, prompts, domain.domainName, domain.selectedMeaning || undefined);
    console.log('✅ Home page content generated with initial blogs.');

    // Update domain status
    console.log('✅ Updating domain status to ACTIVE');
    await this.prisma.domain.update({
      where: { id: dto.domainId },
      data: { status: 'ACTIVE' },
    });

    console.log('🎉 === WEBSITE GENERATION COMPLETED ===\n');

    return this.prisma.website.findUnique({
      where: { id: website.id },
      include: {
        domain: true,
        pages: {
          include: {
            sections: {
              include: {
                contentBlocks: true,
              },
            },
          },
        },
      },
    });
  }

  private async createPage(websiteId: string, slug: string, title: string) {
    return this.prisma.page.create({
      data: {
        websiteId,
        slug,
        seoTitle: `${title} - Generated Site`,
        seoDescription: `${title} page for your generated website`,
      },
    });
  }

  private async generatePageContent(pageId: string, templateKey: string, prompts: any[], domainName: string, selectedMeaning?: string) {
    console.log(`\n📝 === GENERATE BLOG-BASED CONTENT ===`);
    console.log(`   Domain: ${domainName}`);
    console.log(`   Page ID: ${pageId}`);
    if (selectedMeaning) {
      console.log(`   Selected Meaning: ${selectedMeaning}`);
    }

    // Step 1: Generate 3 blog titles based on domain name
    console.log(`\n🔤 Step 1: Generating 3 blog titles for "${domainName}"...`);
    const domainTopic = domainName.split('.')[0].replace(/-/g, ' ');
    
    // Create topic for title generation (just the topic, not instructions)
    let titleTopic: string;
    if (selectedMeaning) {
      // Include context in the topic directly
      titleTopic = `${domainTopic} - ${selectedMeaning}`;
    } else {
      titleTopic = domainTopic;
    }
    
    console.log(`📝 Using topic: ${titleTopic}`);
    const titles = await this.aiService.generateTitles(titleTopic, 3);
    console.log(`✅ Generated ${titles.length} titles`);

    // Step 2: Generate blog content for each title
    console.log(`\n📝 Step 2: Generating blog posts...`);
    const blogs: Array<{ title: string; content: string }> = [];
    
    for (let i = 0; i < titles.length; i++) {
      console.log(`\n   📄 Generating blog ${i + 1}/${titles.length}: "${titles[i]}"`);
      try {
        const blogContent = await this.aiService.generateBlog(titles[i]);
        blogs.push({ title: titles[i], content: blogContent });
        console.log(`   ✅ Blog ${i + 1} generated (${blogContent.length} characters)`);
      } catch (error) {
        console.log(`   ❌ Failed to generate blog ${i + 1}: ${error.message}`);
      }
    }

    if (blogs.length === 0) {
      throw new Error('Failed to generate any blog content');
    }

    console.log(`\n✅ Generated ${blogs.length} blog posts successfully`);

    // Step 3: Create sections and content blocks
    console.log(`\n🏗️  Step 3: Creating page structure...`);

    // Create HERO section (first blog as featured)
    const heroSection = await this.prisma.section.create({
      data: {
        pageId,
        sectionType: 'hero',
        orderIndex: 0,
      },
    });
    console.log(`   ✅ Hero section created`);

    // Add title block to hero
    await this.prisma.contentBlock.create({
      data: {
        sectionId: heroSection.id,
        blockType: 'text',
        contentJson: JSON.stringify({ text: blogs[0].title }),
        aiPromptId: null,
        lastGeneratedAt: new Date(),
      },
    });

    // Add hero image
    try {
      const imageUrl = await this.aiService.generateImage(`Professional image for: ${blogs[0].title}`);
      await this.prisma.contentBlock.create({
        data: {
          sectionId: heroSection.id,
          blockType: 'image',
          contentJson: JSON.stringify({ url: imageUrl, alt: 'Featured' }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });
      console.log(`   ✅ Hero image generated`);
    } catch (error) {
      console.log(`   ⚠️  Hero image failed, using placeholder`);
      await this.prisma.contentBlock.create({
        data: {
          sectionId: heroSection.id,
          blockType: 'image',
          contentJson: JSON.stringify({ 
            url: `https://placehold.co/1200x600/6366f1/white?text=Featured`,
            alt: 'Featured' 
          }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });
    }

    // Create CONTENT sections (all blogs for grid display)
    for (let i = 0; i < blogs.length; i++) {
      const contentSection = await this.prisma.section.create({
        data: {
          pageId,
          sectionType: 'content',
          orderIndex: i + 1,
        },
      });

      // Add title
      await this.prisma.contentBlock.create({
        data: {
          sectionId: contentSection.id,
          blockType: 'text',
          contentJson: JSON.stringify({ text: blogs[i].title, isTitle: true }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });

      // Add FULL content (entire blog)
      await this.prisma.contentBlock.create({
        data: {
          sectionId: contentSection.id,
          blockType: 'text',
          contentJson: JSON.stringify({ text: blogs[i].content, isFullContent: true }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });

      // Add content preview (first 300 chars for card display)
      const preview = blogs[i].content.substring(0, 300).replace(/^#.*\n/, '').trim() + '...';
      await this.prisma.contentBlock.create({
        data: {
          sectionId: contentSection.id,
          blockType: 'text',
          contentJson: JSON.stringify({ text: preview, isPreview: true }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });

      // Add image
      try {
        const imageUrl = await this.aiService.generateImage(`Professional image for: ${blogs[i].title}`);
        await this.prisma.contentBlock.create({
          data: {
            sectionId: contentSection.id,
            blockType: 'image',
            contentJson: JSON.stringify({ url: imageUrl, alt: blogs[i].title }),
            aiPromptId: null,
            lastGeneratedAt: new Date(),
          },
        });
        console.log(`   ✅ Blog ${i + 1} image generated`);
      } catch (error) {
        console.log(`   ⚠️  Blog ${i + 1} image failed, using placeholder`);
        await this.prisma.contentBlock.create({
          data: {
            sectionId: contentSection.id,
            blockType: 'image',
            contentJson: JSON.stringify({ 
              url: `https://placehold.co/800x400/6366f1/white?text=Article`,
              alt: blogs[i].title 
            }),
            aiPromptId: null,
            lastGeneratedAt: new Date(),
          },
        });
      }

      console.log(`   ✅ Content section ${i + 1} created`);
    }

    // Create FOOTER section
    const footerSection = await this.prisma.section.create({
      data: {
        pageId,
        sectionType: 'footer',
        orderIndex: blogs.length + 1,
      },
    });

    await this.prisma.contentBlock.create({
      data: {
        sectionId: footerSection.id,
        blockType: 'text',
        contentJson: JSON.stringify({ text: `© 2024 ${domainName}. All rights reserved.` }),
        aiPromptId: null,
        lastGeneratedAt: new Date(),
      },
    });
    console.log(`   ✅ Footer section created`);

    console.log(`\n🎉 Page content generation complete!`);
    console.log(`   - 1 Hero section (featured blog)`);
    console.log(`   - ${blogs.length} Content sections`);
    console.log(`   - 1 Footer section`);
  }

  private async generatePageContentOLD_UNUSED(pageId: string, templateKey: string, prompts: any[], domainName: string) {
    // OLD METHOD - UNUSED
    const sectionTypes = ['hero', 'content', 'features', 'footer'];
    
    const titlePrompt = prompts.find(p => p.promptType === 'TEXT' && p.promptKey.toLowerCase().includes('title'));
    const contentPrompt = prompts.find(p => p.promptType === 'TEXT' && p.promptKey.toLowerCase().includes('content'));
    const imagePrompt = prompts.find(p => p.promptType === 'IMAGE');

    console.log(`   📋 Available prompts:`);
    console.log(`      🔤 Title prompt: ${titlePrompt ? titlePrompt.promptKey : 'NONE'}`);
    console.log(`      📝 Content prompt: ${contentPrompt ? contentPrompt.promptKey : 'NONE'}`);
    console.log(`      🖼️  Image prompt: ${imagePrompt ? imagePrompt.promptKey : 'NONE'}`);
    
    for (let i = 0; i < sectionTypes.length; i++) {
      const sectionType = sectionTypes[i];
      
      console.log(`\n   🔨 Creating ${sectionType} section...`);
      const section = await this.prisma.section.create({
        data: {
          pageId,
          sectionType,
          orderIndex: i,
        },
      });

      // Decide which text prompt to use based on section type
      let textPromptToUse: any = null;
      if (sectionType === 'hero' || sectionType === 'footer') {
        // Use title prompt for hero and footer
        textPromptToUse = titlePrompt;
        console.log(`      📝 Using TITLE prompt for ${sectionType}`);
      } else {
        // Use content prompt for content and features
        textPromptToUse = contentPrompt;
        console.log(`      📝 Using CONTENT prompt for ${sectionType}`);
      }

      console.log(`      🖼️  Using IMAGE prompt`);

      // Generate text content (with error handling)
      if (textPromptToUse) {
        try {
          console.log(`      🤖 Generating text with AI...`);
          // Use title generator for headings, article generator for content
          let textContent: string;
          // Inject domain context into prompt
          const contextualPrompt = `${textPromptToUse.promptText}\n\nContext: This content is for ${domainName}`;
          
          if (textPromptToUse === titlePrompt) {
            // This is a title prompt - use title generator
            textContent = await this.aiService.generateTitle(contextualPrompt);
          } else {
            // This is a content prompt - use blog generator
            textContent = await this.aiService.generateBlog(contextualPrompt);
          }
          
          await this.prisma.contentBlock.create({
            data: {
              sectionId: section.id,
              blockType: 'text',
              contentJson: JSON.stringify({ text: textContent }),
              aiPromptId: textPromptToUse.id,
              lastGeneratedAt: new Date(),
            },
          });
          console.log(`      ✅ Text content created with AI`);
        } catch (error) {
          console.log(`      ❌ AI generation failed: ${error.message}`);
          console.log(`      🔄 Using fallback content instead...`);
          const fallbackText = this.getFallbackText(sectionType);
          await this.prisma.contentBlock.create({
            data: {
              sectionId: section.id,
              blockType: 'text',
              contentJson: JSON.stringify({ text: fallbackText }),
              aiPromptId: textPromptToUse.id,
              lastGeneratedAt: new Date(),
            },
          });
          console.log(`      ✅ Fallback text content created`);
        }
      } else {
        // Fallback: Create default content even without prompt
        console.log(`      ⚠️  No prompt found, creating fallback content`);
        const fallbackText = this.getFallbackText(sectionType);
        await this.prisma.contentBlock.create({
          data: {
            sectionId: section.id,
            blockType: 'text',
            contentJson: JSON.stringify({ text: fallbackText }),
            aiPromptId: null,
            lastGeneratedAt: new Date(),
          },
        });
        console.log(`      ✅ Fallback text content created`);
      }

      // Generate image content (with error handling)
      if (imagePrompt) {
        try {
          console.log(`      🎨 Generating image with AI...`);
          // Inject domain context into image prompt
          const contextualImagePrompt = `${imagePrompt.promptText} for ${domainName}`;
          const imageUrl = await this.aiService.generateImage(contextualImagePrompt);
          
          await this.prisma.contentBlock.create({
            data: {
              sectionId: section.id,
              blockType: 'image',
              contentJson: JSON.stringify({ url: imageUrl, alt: sectionType }),
              aiPromptId: imagePrompt.id,
              lastGeneratedAt: new Date(),
            },
          });
          console.log(`      ✅ Image content created with AI`);
        } catch (error) {
          console.log(`      ❌ Image generation failed: ${error.message}`);
          console.log(`      🔄 Using placeholder image instead...`);
          const fallbackImage = `https://placehold.co/1200x600/6366f1/white?text=${encodeURIComponent(sectionType)}`;
          await this.prisma.contentBlock.create({
            data: {
              sectionId: section.id,
              blockType: 'image',
              contentJson: JSON.stringify({ url: fallbackImage, alt: sectionType }),
              aiPromptId: imagePrompt.id,
              lastGeneratedAt: new Date(),
            },
          });
          console.log(`      ✅ Placeholder image created`);
        }
      } else {
        // Fallback: Create placeholder image
        console.log(`      ⚠️  No image prompt found, creating placeholder`);
        const fallbackImage = `https://placehold.co/1200x600/6366f1/white?text=${encodeURIComponent(sectionType)}`;
        await this.prisma.contentBlock.create({
          data: {
            sectionId: section.id,
            blockType: 'image',
            contentJson: JSON.stringify({ url: fallbackImage, alt: sectionType }),
            aiPromptId: null,
            lastGeneratedAt: new Date(),
          },
        });
        console.log(`      ✅ Fallback image content created`);
      }
    }
  }

  private getFallbackText(sectionType: string): string {
    const fallbacks = {
      hero: 'Welcome to Your Website - Transform Your Business Today',
      content: 'This is your main content section. Add compelling information about your products or services here. You can edit this content anytime from the CMS dashboard.',
      features: 'Key Feature - Discover what makes us unique and why customers choose our solutions.',
      footer: '© 2024 Your Company. All rights reserved.',
    };
    return fallbacks[sectionType] || 'Content goes here';
  }

  /**
   * Generate subdomain from domain name
   * Example: chocolate.com -> chocolate
   * Example: my-awesome-site.io -> my-awesome-site
   */
  private generateSubdomain(domainName: string): string {
    // Remove TLD (.com, .net, etc.) and get the main part
    const mainPart = domainName.split('.')[0];
    
    // Sanitize: lowercase, remove special chars, replace spaces with hyphens
    const sanitized = mainPart
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36).slice(-4);
    
    return `${sanitized}-${timestamp}`;
  }

  async updateAds(websiteId: string, userId: string, userRole: string, dto: UpdateAdsDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    // Check ownership
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Only super admin can approve ads
    if (dto.adsApproved !== undefined && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admin can approve ads');
    }

    return this.prisma.website.update({
      where: { id: websiteId },
      data: dto,
    });
  }

  async updateContactForm(websiteId: string, userId: string, userRole: string, dto: UpdateContactFormDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    // Check ownership
    if (userRole !== 'SUPER_ADMIN' && website.domain.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.website.update({
      where: { id: websiteId },
      data: { contactFormEnabled: dto.contactFormEnabled },
    });
  }

  /**
   * Generate content for a single page
   */
  async generateSinglePage(websiteId: string, pageId: string, userId: string) {
    console.log(`\n🎨 === GENERATE SINGLE PAGE ===`);
    console.log(`Website ID: ${websiteId}, Page ID: ${pageId}, User ID: ${userId}`);

    // Get website with domain
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { domain: true },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    // Check ownership
    if (website.domain.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Get page
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { sections: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (page.websiteId !== websiteId) {
      throw new ForbiddenException('Page does not belong to this website');
    }

    // Check if page already has content (sections with content blocks)
    if (page.sections.length > 0) {
      console.log(`⚠️  Page already has sections. Deleting existing content...`);
      // Delete existing sections and their content blocks
      await this.prisma.section.deleteMany({
        where: { pageId: page.id },
      });
    }

    // Fetch AI prompts
    const prompts = await this.prisma.aiPrompt.findMany({
      where: { templateKey: website.templateKey },
    });

    if (prompts.length === 0) {
      throw new NotFoundException(`No AI prompts found for template: ${website.templateKey}`);
    }

    // Generate content for this page
    console.log(`🎨 Generating content for page: ${page.slug}`);
    await this.generatePageContent(page.id, website.templateKey, prompts, website.domain.domainName);

    console.log(`✅ Page ${page.slug} content generated successfully`);
    return { message: `Content generated for page: ${page.slug}`, pageId: page.id };
  }

  /**
   * Generate content for all remaining empty pages
   */
  async generateAllPages(websiteId: string, userId: string) {
    console.log(`\n🌐 === GENERATE ALL PAGES ===`);
    console.log(`Website ID: ${websiteId}, User ID: ${userId}`);

    // Get website with domain and pages
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        domain: true,
        pages: {
          include: {
            sections: true,
          },
        },
      },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    // Check ownership
    if (website.domain.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Fetch AI prompts
    const prompts = await this.prisma.aiPrompt.findMany({
      where: { templateKey: website.templateKey },
    });

    if (prompts.length === 0) {
      throw new NotFoundException(`No AI prompts found for template: ${website.templateKey}`);
    }

    // Generate content for all pages that don't have sections
    const pagesGenerated: string[] = [];
    for (const page of website.pages) {
      if (page.sections.length === 0) {
        console.log(`🎨 Generating content for empty page: ${page.slug}`);
        await this.generatePageContent(page.id, website.templateKey, prompts, website.domain.domainName);
        pagesGenerated.push(page.slug);
      } else {
        console.log(`⏭️  Skipping page ${page.slug} - already has content`);
      }
    }

    if (pagesGenerated.length === 0) {
      return { message: 'All pages already have content', pagesGenerated: [] };
    }

    console.log(`✅ Generated content for ${pagesGenerated.length} pages: ${pagesGenerated.join(', ')}`);
    return {
      message: `Content generated for ${pagesGenerated.length} page(s)`,
      pagesGenerated,
    };
  }

  /**
   * Generate MORE blogs for an existing page (adds 3 more blogs)
   */
  async generateMoreBlogs(websiteId: string, userId: string) {
    console.log(`\n📝 === GENERATE MORE BLOGS ===`);
    console.log(`Website ID: ${websiteId}, User ID: ${userId}`);

    // Get website with domain and home page
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        domain: true,
        pages: {
          where: { slug: '/' }, // Home page
          include: {
            sections: {
              orderBy: { orderIndex: 'desc' },
              take: 1, // Get the last section to determine next orderIndex
            },
          },
        },
      },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    // Check ownership
    if (website.domain.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const homePage = website.pages[0];
    if (!homePage) {
      throw new NotFoundException('Home page not found');
    }

    // Get the current highest orderIndex for sections
    const lastSection = homePage.sections[0];
    let nextOrderIndex = lastSection ? lastSection.orderIndex + 1 : 1;

    // Generate 3 new blog titles
    console.log(`\n🔤 Generating 3 new blog titles for "${website.domain.domainName}"...`);
    const domainTopic = website.domain.domainName.split('.')[0].replace(/-/g, ' ');
    
    // Create topic for title generation (just the topic, not instructions)
    let titleTopic: string;
    if (website.domain.selectedMeaning) {
      // Include context in the topic directly
      titleTopic = `${domainTopic} - ${website.domain.selectedMeaning}`;
      console.log(`📝 Using context: ${website.domain.selectedMeaning}`);
    } else {
      titleTopic = domainTopic;
    }
    
    console.log(`📝 Using topic: ${titleTopic}`);
    const titles = await this.aiService.generateTitles(titleTopic, 3);
    console.log(`✅ Generated ${titles.length} new titles`);

    // Generate blog content for each title
    console.log(`\n📝 Generating new blog posts...`);
    const blogs: Array<{ title: string; content: string }> = [];
    
    for (let i = 0; i < titles.length; i++) {
      console.log(`\n   📄 Generating blog ${i + 1}/${titles.length}: "${titles[i]}"`);
      try {
        const blogContent = await this.aiService.generateBlog(titles[i]);
        blogs.push({ title: titles[i], content: blogContent });
        console.log(`   ✅ Blog ${i + 1} generated (${blogContent.length} characters)`);
      } catch (error) {
        console.log(`   ❌ Failed to generate blog ${i + 1}: ${error.message}`);
      }
    }

    if (blogs.length === 0) {
      throw new Error('Failed to generate any new blog content');
    }

    console.log(`\n✅ Generated ${blogs.length} new blog posts successfully`);

    // Add new content sections for each blog
    console.log(`\n🏗️  Adding new blog sections...`);

    for (let i = 0; i < blogs.length; i++) {
      const contentSection = await this.prisma.section.create({
        data: {
          pageId: homePage.id,
          sectionType: 'content',
          orderIndex: nextOrderIndex + i,
        },
      });

      // Add title
      await this.prisma.contentBlock.create({
        data: {
          sectionId: contentSection.id,
          blockType: 'text',
          contentJson: JSON.stringify({ text: blogs[i].title, isTitle: true }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });

      // Add full content
      await this.prisma.contentBlock.create({
        data: {
          sectionId: contentSection.id,
          blockType: 'text',
          contentJson: JSON.stringify({ text: blogs[i].content, isFullContent: true }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });

      // Add content preview
      const preview = blogs[i].content.substring(0, 300).replace(/^#.*\n/, '').trim() + '...';
      await this.prisma.contentBlock.create({
        data: {
          sectionId: contentSection.id,
          blockType: 'text',
          contentJson: JSON.stringify({ text: preview, isPreview: true }),
          aiPromptId: null,
          lastGeneratedAt: new Date(),
        },
      });

      // Add image
      try {
        const imageUrl = await this.aiService.generateImage(`Professional image for: ${blogs[i].title}`);
        await this.prisma.contentBlock.create({
          data: {
            sectionId: contentSection.id,
            blockType: 'image',
            contentJson: JSON.stringify({ url: imageUrl, alt: blogs[i].title }),
            aiPromptId: null,
            lastGeneratedAt: new Date(),
          },
        });
        console.log(`   ✅ Blog ${i + 1} image generated`);
      } catch (error) {
        console.log(`   ⚠️  Blog ${i + 1} image failed, using placeholder`);
        await this.prisma.contentBlock.create({
          data: {
            sectionId: contentSection.id,
            blockType: 'image',
            contentJson: JSON.stringify({ 
              url: `https://placehold.co/800x400/6366f1/white?text=Article`,
              alt: blogs[i].title 
            }),
            aiPromptId: null,
            lastGeneratedAt: new Date(),
          },
        });
      }

      console.log(`   ✅ Blog section ${i + 1} added`);
    }

    console.log(`\n🎉 Successfully added ${blogs.length} new blogs!`);
    return {
      message: `Successfully generated ${blogs.length} more blogs`,
      blogsAdded: blogs.length,
    };
  }
}

