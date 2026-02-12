import { Job } from 'bull';
import prisma from '../../config/prisma';
import { AiService } from '../../ai-service/ai.service';
import { WebsiteGenerationJob } from '../website-queue.service';

const aiService = new AiService();

export async function processGenerateWebsite(job: Job<WebsiteGenerationJob>) {
  const { domainId, templateKey, contactFormEnabled } = job.data;

  console.log(`\n🚀 Starting website generation job ${job.id} for domain ${domainId}`);
  console.log(`   Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 1}`);

  try {
    // Update job progress
    await job.progress(10);

    // Get domain
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      // Non-retryable error - domain doesn't exist (may have been deleted)
      console.log(`❌ Domain ${domainId} not found - it may have been deleted`);
      if (job.opts.attempts) {
        job.opts.attempts = 1; // Don't retry
      }
      throw new Error('Domain not found (may have been deleted)');
    }

    await job.progress(20);

    // IDEMPOTENCY CHECK: Check if website already exists for this domain
    const existingWebsite = await prisma.website.findUnique({
      where: { domainId },
    });

    if (existingWebsite) {
      console.log(
        `✅ Website already exists for domain ${domain.domainName} (idempotent completion)`
      );

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
    const website = await prisma.website.create({
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
    const homePage = await prisma.page.create({
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
    await generatePageContent(
      homePage.id,
      domain.domainName,
      job,
      domain.selectedMeaning || undefined
    );

    await job.progress(90);

    // Update domain status to ACTIVE
    await prisma.domain.update({
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
  } catch (error: any) {
    console.error(
      `❌ Error in job ${job.id} (attempt ${job.attemptsMade + 1}):`,
      error.message
    );

    // Cleanup partially created website on final failure
    if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      console.log(
        `🧹 Final attempt failed - cleaning up partial data for domain ${domainId}...`
      );

      try {
        // Delete website if it was partially created (cascade will delete pages/sections/blocks)
        await prisma.website.deleteMany({
          where: { domainId },
        });

        // Reset domain status to PENDING (only if domain still exists)
        const domainExists = await prisma.domain.findUnique({
          where: { id: domainId },
        });

        if (domainExists) {
          await prisma.domain.update({
            where: { id: domainId },
            data: { status: 'PENDING' },
          });
          console.log(`✅ Cleanup completed for domain ${domainId}`);
        } else {
          console.log(`ℹ️  Domain ${domainId} was already deleted - skipping cleanup`);
        }
      } catch (cleanupError: any) {
        console.error(`⚠️  Cleanup failed:`, cleanupError.message);
      }
    }

    throw error;
  }
}

export async function processGenerateMoreBlogs(
  job: Job<{ websiteId: string; userId: string; quantity?: number }>
) {
  const { websiteId, quantity = 3 } = job.data;

  console.log(`\n🚀 Starting generate more blogs job ${job.id} (${quantity} blog(s))`);

  try {
    await job.progress(10);

    // Get website with domain
    const website = await prisma.website.findUnique({
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
    const currentMaxOrder = Math.max(
      ...homePage.sections.map((s) => s.orderIndex),
      0
    );

    // Generate new blog titles
    const domainTopic = website.domain.domainName
      .split('.')[0]
      .replace(/-/g, ' ');

    // Create topic for title generation (just the topic, not instructions)
    let titleTopic: string;
    if (website.domain.selectedMeaning) {
      titleTopic = `${domainTopic} - ${website.domain.selectedMeaning}`;
      console.log(`📝 Using context: ${website.domain.selectedMeaning}`);
    } else {
      titleTopic = domainTopic;
    }

    console.log(`🔤 Generating ${quantity} new blog title(s)...`);
    console.log(`📝 Topic: ${titleTopic}`);
    const titles = await aiService.generateTitle(titleTopic, quantity);

    await job.progress(40);

    // Generate content for each title
    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const progress = 40 + ((i + 1) / titles.length) * 50;

      console.log(`\n📝 Blog ${i + 1}/${quantity}: ${title.substring(0, 50)}...`);

      // Generate blog content
      const blogContent = await aiService.generateBlogContent(title);
      const preview = blogContent.substring(0, 300) + '...';

      // Generate image
      const imagePrompt = `Professional image for: ${title}`;
      const imageUrl = await aiService.generateImage(imagePrompt);

      // Create section
      const section = await prisma.section.create({
        data: {
          pageId: homePage.id,
          sectionType: 'content',
          orderIndex: currentMaxOrder + i + 1,
        },
      });

      // Create content blocks
      await prisma.contentBlock.createMany({
        data: [
          {
            sectionId: section.id,
            blockType: 'text',
            contentJson: JSON.stringify({ text: title, isTitle: true }),
          },
          {
            sectionId: section.id,
            blockType: 'text',
            contentJson: JSON.stringify({
              text: blogContent,
              isFullContent: true,
            }),
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
    console.log(`\n🎉 ${quantity} new blog(s) generated successfully!\n`);

    return {
      success: true,
      blogsGenerated: quantity,
      message: `${quantity} new blog(s) generated successfully`,
    };
  } catch (error) {
    console.error(`❌ Error in job ${job.id}:`, error);
    throw error;
  }
}

async function generatePageContent(
  pageId: string,
  domainName: string,
  job: Job,
  selectedMeaning?: string
) {
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
  const titles = await aiService.generateTitle(titleTopic, 3);

  await job.progress(50);

  // Step 2: Generate content for each blog
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const progress = 50 + ((i + 1) / titles.length) * 30;

    console.log(`\n📝 Blog ${i + 1}/3: ${title.substring(0, 50)}...`);

    // Generate blog content
    const blogContent = await aiService.generateBlogContent(title);
    const preview = blogContent.substring(0, 300) + '...';

    // Generate image
    const imagePrompt = `Professional image for: ${title}`;
    const imageUrl = await aiService.generateImage(imagePrompt);

    // Create section
    const section = await prisma.section.create({
      data: {
        pageId,
        sectionType: 'content',
        orderIndex: i,
      },
    });

    // Create content blocks
    await prisma.contentBlock.createMany({
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
