import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-service/ai.service';
import { WebsiteGenerationJob } from './website-queue.service';

@Processor('website-generation')
export class WebsiteProcessor {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  @Process('generate-website')
  async handleWebsiteGeneration(job: Job<WebsiteGenerationJob>) {
    const { domainId, templateKey, contactFormEnabled } = job.data;

    console.log(`\n🚀 Starting website generation job ${job.id} for domain ${domainId}`);
    console.log(`   Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 1}`);
    
    try {
      // Update job progress
      await job.progress(10);

      // Get domain
      const domain = await this.prisma.domain.findUnique({
        where: { id: domainId },
      });

      if (!domain) {
        // Non-retryable error - domain doesn't exist
        job.opts.attempts = 1; // Don't retry
        throw new Error('Domain not found');
      }

      await job.progress(20);

      // IDEMPOTENCY CHECK: Check if website already exists for this domain
      const existingWebsite = await this.prisma.website.findUnique({
        where: { domainId },
      });

      if (existingWebsite) {
        console.log(`✅ Website already exists for domain ${domain.domainName} (idempotent completion)`);
        
        // Return existing website as successful completion (idempotent)
        return {
          success: true,
          websiteId: existingWebsite.id,
          subdomain: existingWebsite.subdomain,
          message: 'Website already generated (idempotent)',
          alreadyExisted: true,
        };
      }

      // Generate subdomain
      const randomString = Math.random().toString(36).substring(2, 6);
      const subdomain = `${domain.domainName.split('.')[0]}-${randomString}`;

      // Create website
      const website = await this.prisma.website.create({
        data: {
          domainId,
          subdomain,
          templateKey,
          contactFormEnabled,
        },
      });

      console.log(`✅ Website created with subdomain: ${subdomain}`);
      await job.progress(30);

      // Create Home page
      const homePage = await this.prisma.page.create({
        data: {
          websiteId: website.id,
          slug: '/',
          seoTitle: `${domain.domainName} - Home`,
          seoDescription: `Welcome to ${domain.domainName}`,
        },
      });

      console.log(`✅ Home page created`);
      await job.progress(40);

      // Generate content with selected meaning context
      await this.generatePageContent(homePage.id, domain.domainName, job, domain.selectedMeaning || undefined);

      await job.progress(90);

      // Update domain status to ACTIVE
      await this.prisma.domain.update({
        where: { id: domainId },
        data: { status: 'ACTIVE' },
      });

      console.log(`✅ Domain ${domain.domainName} is now ACTIVE`);
      await job.progress(100);

      console.log(`\n🎉 Website generation completed for ${domain.domainName}!\n`);

      return {
        success: true,
        websiteId: website.id,
        subdomain,
        message: 'Website generated successfully',
      };
    } catch (error) {
      console.error(`❌ Error in job ${job.id} (attempt ${job.attemptsMade + 1}):`, error.message);
      
      // Cleanup partially created website on final failure
      if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
        console.log(`🧹 Final attempt failed - cleaning up partial data for domain ${domainId}...`);
        
        try {
          // Delete website if it was partially created (cascade will delete pages/sections/blocks)
          await this.prisma.website.deleteMany({
            where: { domainId },
          });
          
          // Reset domain status to PENDING
          await this.prisma.domain.update({
            where: { id: domainId },
            data: { status: 'PENDING' },
          });
          
          console.log(`✅ Cleanup completed for domain ${domainId}`);
        } catch (cleanupError) {
          console.error(`⚠️  Cleanup failed:`, cleanupError.message);
        }
      }
      
      throw error;
    }
  }

  @Process('generate-more-blogs')
  async handleGenerateMoreBlogs(job: Job<{ websiteId: string; userId: string }>) {
    const { websiteId } = job.data;

    console.log(`\n🚀 Starting generate more blogs job ${job.id}`);

    try {
      await job.progress(10);

      // Get website with domain
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        include: {
          domain: true,
          pages: {
            where: { slug: '/' },
            include: { sections: true },
          },
        },
      });

      if (!website) {
        throw new Error('Website not found');
      }

      await job.progress(20);

      const homePage = website.pages[0];
      const currentMaxOrder = Math.max(...homePage.sections.map(s => s.orderIndex), 0);

      // Generate 3 new blog titles
      const domainTopic = website.domain.domainName.split('.')[0].replace(/-/g, ' ');
      
      // Create topic for title generation (just the topic, not instructions)
      let titleTopic: string;
      if (website.domain.selectedMeaning) {
        titleTopic = `${domainTopic} - ${website.domain.selectedMeaning}`;
        console.log(`📝 Using context: ${website.domain.selectedMeaning}`);
      } else {
        titleTopic = domainTopic;
      }
      
      console.log(`🔤 Generating 3 new blog titles...`);
      console.log(`📝 Topic: ${titleTopic}`);
      const titles = await this.aiService.generateTitles(titleTopic, 3);

      await job.progress(40);

      // Generate content for each title
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        const progress = 40 + ((i + 1) / titles.length) * 50;

        console.log(`\n📝 Blog ${i + 1}/3: ${title.substring(0, 50)}...`);

        // Generate blog content
        const blogContent = await this.aiService.generateBlog(title);
        const preview = blogContent.substring(0, 300) + '...';

        // Generate image
        const imagePrompt = `Professional image for: ${title}`;
        const imageUrl = await this.aiService.generateImage(imagePrompt);

        // Create section
        const section = await this.prisma.section.create({
          data: {
            pageId: homePage.id,
            sectionType: 'content',
            orderIndex: currentMaxOrder + i + 1,
          },
        });

        // Create content blocks
        await this.prisma.contentBlock.createMany({
          data: [
            {
              sectionId: section.id,
              blockType: 'text',
              contentJson: JSON.stringify({ text: title, isTitle: true }),
            },
            {
              sectionId: section.id,
              blockType: 'text',
              contentJson: JSON.stringify({ text: blogContent, isFullContent: true }),
            },
            {
              sectionId: section.id,
              blockType: 'text',
              contentJson: JSON.stringify({ text: preview, isPreview: true }),
            },
            {
              sectionId: section.id,
              blockType: 'image',
              contentJson: JSON.stringify({ url: imageUrl, alt: title }),
            },
          ],
        });

        console.log(`✅ Blog ${i + 1} created`);
        await job.progress(progress);
      }

      await job.progress(100);
      console.log(`\n🎉 3 new blogs generated successfully!\n`);

      return {
        success: true,
        blogsGenerated: 3,
        message: '3 new blogs generated successfully',
      };
    } catch (error) {
      console.error(`❌ Error in job ${job.id}:`, error);
      throw error;
    }
  }

  private async generatePageContent(pageId: string, domainName: string, job: Job, selectedMeaning?: string) {
    console.log(`\n🎨 Generating content for ${domainName}...`);

    // Step 1: Generate 3 blog titles
    const domainTopic = domainName.split('.')[0].replace(/-/g, ' ');
    
    // Create topic for title generation (just the topic, not instructions)
    let titleTopic: string;
    if (selectedMeaning) {
      titleTopic = `${domainTopic} - ${selectedMeaning}`;
      console.log(`📝 Using context: ${selectedMeaning}`);
    } else {
      titleTopic = domainTopic;
    }
    
    console.log(`🔤 Generating 3 blog titles...`);
    console.log(`📝 Topic: ${titleTopic}`);
    const titles = await this.aiService.generateTitles(titleTopic, 3);
    
    await job.progress(50);

    // Step 2: Generate content for each blog
    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const progress = 50 + ((i + 1) / titles.length) * 30;

      console.log(`\n📝 Blog ${i + 1}/3: ${title.substring(0, 50)}...`);

      // Generate blog content
      const blogContent = await this.aiService.generateBlog(title);
      const preview = blogContent.substring(0, 300) + '...';

      // Generate image
      const imagePrompt = `Professional image for: ${title}`;
      const imageUrl = await this.aiService.generateImage(imagePrompt);

      // Create section
      const section = await this.prisma.section.create({
        data: {
          pageId,
          sectionType: 'content',
          orderIndex: i,
        },
      });

      // Create content blocks
      await this.prisma.contentBlock.createMany({
        data: [
          {
            sectionId: section.id,
            blockType: 'text',
            contentJson: JSON.stringify({ text: title, isTitle: true }),
          },
          {
            sectionId: section.id,
            blockType: 'text',
            contentJson: JSON.stringify({ text: blogContent, isFullContent: true }),
          },
          {
            sectionId: section.id,
            blockType: 'text',
            contentJson: JSON.stringify({ text: preview, isPreview: true }),
          },
          {
            sectionId: section.id,
            blockType: 'image',
            contentJson: JSON.stringify({ url: imageUrl, alt: title }),
          },
        ],
      });

      console.log(`✅ Blog ${i + 1} created`);
      await job.progress(progress);
    }

    console.log(`✅ All content generated for ${domainName}`);
  }
}


