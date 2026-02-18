import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { AiService } from '../ai-service/ai.service';

interface UpdateContentDto {
  content: any;
}

export class ContentService {
  private aiService: AiService;

  constructor() {
    this.aiService = new AiService();
  }

  /**
   * Manual content update by user
   */
  async update(
    blockId: string,
    userId: string,
    userRole: string,
    dto: UpdateContentDto
  ) {
    const block = await this.getBlockWithOwnership(blockId);

    // Verify ownership
    await this.verifyOwnership(block, userId, userRole);

    return prisma.contentBlock.update({
      where: { id: blockId },
      data: {
        contentJson: JSON.stringify(dto.content),
      },
    });
  }

  /**
   * Regenerate content using AI based on stored prompt
   */
  async regenerate(blockId: string, userId: string, userRole: string) {
    const block = await this.getBlockWithOwnership(blockId);

    // Verify ownership
    await this.verifyOwnership(block, userId, userRole);

    if (!block.aiPromptId) {
      throw new AppError(
        'No AI prompt associated with this content block',
        403
      );
    }

    const prompt = await prisma.aiPrompt.findUnique({
      where: { id: block.aiPromptId },
    });

    if (!prompt) {
      throw new AppError('AI prompt not found', 404);
    }

    // Get domain name for context
    const domainName = block.section.page.website.domain.domainName;
    console.log(
      `🔄 Regenerating content for block ${blockId} (domain: ${domainName})`
    );

    // Generate new content based on prompt type
    let newContent: any;

    if (prompt.promptType === 'TEXT') {
      const isHeading =
        block.section.sectionType === 'hero' ||
        block.section.sectionType === 'footer' ||
        prompt.promptKey.toLowerCase().includes('heading') ||
        prompt.promptKey.toLowerCase().includes('title');

      const contextualPrompt = `${prompt.promptText}\n\nContext: This content is for ${domainName}`;

      if (isHeading) {
        console.log(`📝 Regenerating title...`);
        const titles = await this.aiService.generateTitle(contextualPrompt, 1);
        const text = titles[0];
        if (!text) {
          throw new Error('Title generation returned empty/undefined text');
        }
        newContent = { text };
        console.log(`✅ Title regenerated: ${text.substring(0, 50)}...`);
      } else {
        console.log(`📄 Regenerating blog content...`);
        const text = await this.aiService.generateBlogContent(contextualPrompt);
        if (!text) {
          throw new Error('Blog generation returned empty/undefined text');
        }
        newContent = { text };
        console.log(`✅ Content regenerated (${text ? text.length : 0} chars)`);
      }
    } else if (prompt.promptType === 'IMAGE') {
      console.log(`🎨 Regenerating image...`);
      const contextualPrompt = `${prompt.promptText} for ${domainName}`;
      const url = await this.aiService.generateImage(contextualPrompt);
      newContent = { url, alt: block.section.sectionType };
      console.log(`✅ Image regenerated: ${url}`);
    }

    // Update content block
    const updated = await prisma.contentBlock.update({
      where: { id: blockId },
      data: {
        contentJson: JSON.stringify(newContent),
        lastGeneratedAt: new Date(),
      },
    });

    console.log(`💾 Content block updated in database`);

    // Log regeneration
    await prisma.regenerationLog.create({
      data: {
        contentBlockId: blockId,
        userId,
      },
    });

    console.log(`✅ Regeneration complete for block ${blockId}`);

    return updated;
  }

  /**
   * Regenerate only the title of a blog section
   */
  async regenerateTitle(sectionId: string, userId: string, userRole: string) {
    const section = await this.getSectionWithOwnership(sectionId);
    await this.verifySectionOwnership(section, userId, userRole);

    console.log(`🔄 Regenerating title for section ${sectionId}`);

    // Find the title block
    const titleBlock =
      section.contentBlocks.find((b) => {
        try {
          const content = JSON.parse(b.contentJson);
          return content.isTitle === true;
        } catch {
          return false;
        }
      }) || section.contentBlocks.find((b) => b.blockType === 'text');

    if (!titleBlock) {
      throw new AppError('Title block not found', 404);
    }

    // Get domain context
    const domain = section.page.website.domain;
    const domainName = domain.domainName;
    const domainTopic = domainName.split('.')[0].replace(/-/g, ' ');

    // Build topic with all available context
    let titleTopic: string = domainTopic;
    
    // Add user description if provided
    if (domain.userDescription) {
      titleTopic = `${domainTopic} - ${domain.userDescription}`;
      console.log(`📝 Using user description: ${domain.userDescription}`);
    }
    
    // Add selected meaning if provided
    if (domain.selectedMeaning) {
      titleTopic = domain.userDescription 
        ? `${titleTopic} (${domain.selectedMeaning})`
        : `${domainTopic} - ${domain.selectedMeaning}`;
      console.log(`📝 Using context: ${domain.selectedMeaning}`);
    }

    console.log(`📝 Generating title with topic: ${titleTopic}`);

    // Generate new title
    const newTitles = await this.aiService.generateTitle(titleTopic, 1);
    console.log(`✅ New title generated: ${newTitles[0]}`);

    // Update title block
    return prisma.contentBlock.update({
      where: { id: titleBlock.id },
      data: {
        contentJson: JSON.stringify({ text: newTitles[0], isTitle: true }),
        lastGeneratedAt: new Date(),
      },
    });
  }

  /**
   * Regenerate only the content of a blog section
   */
  async regenerateContent(
    sectionId: string,
    userId: string,
    userRole: string
  ) {
    const section = await this.getSectionWithOwnership(sectionId);
    await this.verifySectionOwnership(section, userId, userRole);

    console.log(`🔄 Regenerating content for section ${sectionId}`);

    // Find content blocks
    const fullContentBlock = section.contentBlocks.find((b) => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isFullContent === true;
      } catch {
        return false;
      }
    });

    const previewBlock = section.contentBlocks.find((b) => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isPreview === true;
      } catch {
        return false;
      }
    });

    if (!fullContentBlock) {
      throw new AppError('Content block not found', 404);
    }

    // Get the title for context
    const titleBlock = section.contentBlocks.find((b) => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isTitle === true;
      } catch {
        return false;
      }
    });

    const currentContent = titleBlock
      ? JSON.parse(titleBlock.contentJson)
      : { text: '' };
    const title = currentContent.text || 'Article';

    // Generate new blog content
    console.log(`📝 Generating new content for: ${title.substring(0, 50)}...`);
    const newContent = await this.aiService.generateBlogContent(title);
    const preview = newContent.substring(0, 300) + '...';

    console.log(`✅ New content generated (${newContent.length} chars)`);

    // Update blocks
    await prisma.contentBlock.update({
      where: { id: fullContentBlock.id },
      data: {
        contentJson: JSON.stringify({ text: newContent, isFullContent: true }),
        lastGeneratedAt: new Date(),
      },
    });

    if (previewBlock) {
      await prisma.contentBlock.update({
        where: { id: previewBlock.id },
        data: {
          contentJson: JSON.stringify({ text: preview, isPreview: true }),
          lastGeneratedAt: new Date(),
        },
      });
    }

    return { success: true, message: 'Content regenerated successfully' };
  }

  /**
   * Regenerate only the image of a blog section
   */
  async regenerateImage(sectionId: string, userId: string, userRole: string) {
    const section = await this.getSectionWithOwnership(sectionId);
    await this.verifySectionOwnership(section, userId, userRole);

    console.log(`🔄 Regenerating image for section ${sectionId}`);

    // Find the image block
    const imageBlock = section.contentBlocks.find((b) => b.blockType === 'image');

    if (!imageBlock) {
      throw new AppError('Image block not found', 404);
    }

    // Get title for context
    const titleBlock = section.contentBlocks.find((b) => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isTitle === true;
      } catch {
        return false;
      }
    });

    const currentContent = titleBlock
      ? JSON.parse(titleBlock.contentJson)
      : { text: '' };
    const title = currentContent.text || 'Article';

    // Generate new image
    const imagePrompt = `Professional, high-quality image for article: ${title}`;
    console.log(
      `🎨 Generating image with prompt: ${imagePrompt.substring(0, 80)}...`
    );

    const imageUrl = await this.aiService.generateImage(imagePrompt);
    console.log(`✅ New image generated: ${imageUrl}`);

    // Update image block
    return prisma.contentBlock.update({
      where: { id: imageBlock.id },
      data: {
        contentJson: JSON.stringify({ url: imageUrl, alt: title }),
        lastGeneratedAt: new Date(),
      },
    });
  }

  /**
   * Delete a blog section (with safety check for hero)
   */
  async deleteSection(sectionId: string, userId: string, userRole: string) {
    const section = await this.getSectionWithOwnership(sectionId);
    await this.verifySectionOwnership(section, userId, userRole);

    // Safety check: Don't allow deletion of hero section
    if (section.orderIndex === 0) {
      throw new AppError(
        'Cannot delete the hero section. You can only regenerate it.',
        403
      );
    }

    console.log(`🗑️  Deleting section ${sectionId}`);

    // Delete all content blocks first
    await prisma.contentBlock.deleteMany({
      where: { sectionId },
    });

    // Delete the section
    await prisma.section.delete({
      where: { id: sectionId },
    });

    console.log(`✅ Section deleted successfully`);

    return { success: true, message: 'Blog deleted successfully' };
  }

  /**
   * Reorder a blog section (move up or down)
   */
  async reorderSection(
    sectionId: string,
    userId: string,
    userRole: string,
    direction: 'up' | 'down'
  ) {
    const section = await this.getSectionWithOwnership(sectionId);
    await this.verifySectionOwnership(section, userId, userRole);

    console.log(`🔄 Reordering section ${sectionId} (${direction})`);

    const currentOrder = section.orderIndex;
    const pageId = section.page.id;

    // Get all sections on the same page
    const allSections = await prisma.section.findMany({
      where: { pageId },
      orderBy: { orderIndex: 'asc' },
    });

    // Find the section to swap with
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    const targetSection = allSections.find((s) => s.orderIndex === targetOrder);

    if (!targetSection) {
      throw new AppError(
        `Cannot move ${direction} - already at the ${direction === 'up' ? 'top' : 'bottom'}`,
        400
      );
    }

    // Swap order indexes
    await prisma.$transaction([
      prisma.section.update({
        where: { id: sectionId },
        data: { orderIndex: targetOrder },
      }),
      prisma.section.update({
        where: { id: targetSection.id },
        data: { orderIndex: currentOrder },
      }),
    ]);

    console.log(`✅ Section reordered successfully`);

    return { success: true, message: `Blog moved ${direction} successfully` };
  }

  private async getSectionWithOwnership(sectionId: string) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        contentBlocks: true,
        page: {
          include: {
            website: {
              include: {
                domain: true,
              },
            },
          },
        },
      },
    });

    if (!section) {
      throw new AppError('Section not found', 404);
    }

    return section;
  }

  private async verifySectionOwnership(
    section: any,
    userId: string,
    userRole: string
  ) {
    const ownerId = section.page.website.domain.userId;

    if (userRole !== 'SUPER_ADMIN' && ownerId !== userId) {
      throw new AppError('Access denied', 403);
    }
  }

  private async getBlockWithOwnership(blockId: string) {
    const block = await prisma.contentBlock.findUnique({
      where: { id: blockId },
      include: {
        section: {
          include: {
            page: {
              include: {
                website: {
                  include: {
                    domain: true,
                  },
                },
              },
            },
          },
        },
        aiPrompt: true,
      },
    });

    if (!block) {
      throw new AppError('Content block not found', 404);
    }

    return block;
  }

  private async verifyOwnership(
    block: any,
    userId: string,
    userRole: string
  ) {
    const ownerId = block.section.page.website.domain.userId;

    if (userRole !== 'SUPER_ADMIN' && ownerId !== userId) {
      throw new AppError('Access denied', 403);
    }
  }
}
