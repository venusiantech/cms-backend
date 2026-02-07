import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-service/ai.service';
import { UpdateContentDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * Manual content update by user
   */
  async update(blockId: string, userId: string, userRole: string, dto: UpdateContentDto) {
    const block = await this.getBlockWithOwnership(blockId);
    
    // Verify ownership
    await this.verifyOwnership(block, userId, userRole);

    return this.prisma.contentBlock.update({
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
      throw new ForbiddenException('No AI prompt associated with this content block');
    }

    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id: block.aiPromptId },
    });

    if (!prompt) {
      throw new NotFoundException('AI prompt not found');
    }

    // Get domain name for context
    const domainName = block.section.page.website.domain.domainName;
    console.log(`🔄 Regenerating content for block ${blockId} (domain: ${domainName})`);
    
    // Generate new content based on prompt type
    let newContent: any;
    
    if (prompt.promptType === 'TEXT') {
      // Determine if this is a heading/title or full content
      const isHeading = block.section.sectionType === 'hero' || 
                        block.section.sectionType === 'footer' ||
                        prompt.promptKey.toLowerCase().includes('heading') ||
                        prompt.promptKey.toLowerCase().includes('title');
      
      // Add domain context to prompt
      const contextualPrompt = `${prompt.promptText}\n\nContext: This content is for ${domainName}`;
      
      if (isHeading) {
        console.log(`📝 Regenerating title...`);
        const text = await this.aiService.generateTitle(contextualPrompt);
        if (!text) {
          throw new Error('Title generation returned empty/undefined text');
        }
        newContent = { text };
        console.log(`✅ Title regenerated: ${text.substring(0, 50)}...`);
      } else {
        console.log(`📄 Regenerating blog content...`);
        const text = await this.aiService.generateBlog(contextualPrompt);
        if (!text) {
          throw new Error('Blog generation returned empty/undefined text');
        }
        newContent = { text };
        console.log(`✅ Content regenerated (${text ? text.length : 0} chars)`);
      }
    } else if (prompt.promptType === 'IMAGE') {
      console.log(`🎨 Regenerating image...`);
      // Add domain context to image prompt
      const contextualPrompt = `${prompt.promptText} for ${domainName}`;
      const url = await this.aiService.generateImage(contextualPrompt);
      newContent = { url, alt: block.section.sectionType };
      console.log(`✅ Image regenerated: ${url}`);
    } else if (prompt.promptType === 'SEO') {
      console.log(`🔍 Regenerating SEO...`);
      const seo = await this.aiService.generateSEO(prompt.promptText);
      newContent = seo;
      console.log(`✅ SEO regenerated`);
    }

    // Update content block
    const updated = await this.prisma.contentBlock.update({
      where: { id: blockId },
      data: {
        contentJson: JSON.stringify(newContent),
        lastGeneratedAt: new Date(),
      },
    });
    
    console.log(`💾 Content block updated in database`);
    console.log(`📦 New content: ${JSON.stringify(newContent).substring(0, 100)}...`);

    // Log regeneration
    await this.prisma.regenerationLog.create({
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

    // Find the title block (isTitle flag or first text block)
    const titleBlock = section.contentBlocks.find(b => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isTitle === true;
      } catch {
        return false;
      }
    }) || section.contentBlocks.find(b => b.blockType === 'text');

    if (!titleBlock) {
      throw new NotFoundException('Title block not found');
    }

    // Get domain context
    const domainName = section.page.website.domain.domainName;
    const domainTopic = domainName.split('.')[0].replace(/-/g, ' ');

    // Create a proper prompt for title generation
    const titlePrompt = `Generate professional blog post titles about ${domainTopic}`;
    console.log(`📝 Generating title with prompt: ${titlePrompt}`);

    // Generate new title
    const newTitle = await this.aiService.generateTitles(titlePrompt, 1);
    console.log(`✅ New title generated: ${newTitle[0]}`);

    // Update title block
    return this.prisma.contentBlock.update({
      where: { id: titleBlock.id },
      data: {
        contentJson: JSON.stringify({ text: newTitle[0], isTitle: true }),
        lastGeneratedAt: new Date(),
      },
    });
  }

  /**
   * Regenerate only the content of a blog section
   */
  async regenerateContent(sectionId: string, userId: string, userRole: string) {
    const section = await this.getSectionWithOwnership(sectionId);
    await this.verifySectionOwnership(section, userId, userRole);

    console.log(`🔄 Regenerating content for section ${sectionId}`);

    // Find content blocks (isFullContent and isPreview)
    const fullContentBlock = section.contentBlocks.find(b => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isFullContent === true;
      } catch {
        return false;
      }
    });

    const previewBlock = section.contentBlocks.find(b => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isPreview === true;
      } catch {
        return false;
      }
    });

    if (!fullContentBlock) {
      throw new NotFoundException('Content block not found');
    }

    // Get the title for context
    const titleBlock = section.contentBlocks.find(b => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isTitle === true;
      } catch {
        return false;
      }
    });

    const currentContent = titleBlock ? JSON.parse(titleBlock.contentJson) : { text: '' };
    const title = currentContent.text || 'Article';

    // Generate new blog content
    console.log(`📝 Generating new content for: ${title.substring(0, 50)}...`);
    const newContent = await this.aiService.generateBlog(title);
    const preview = newContent.substring(0, 300) + '...';

    console.log(`✅ New content generated (${newContent.length} chars)`);

    // Update blocks
    await this.prisma.contentBlock.update({
      where: { id: fullContentBlock.id },
      data: {
        contentJson: JSON.stringify({ text: newContent, isFullContent: true }),
        lastGeneratedAt: new Date(),
      },
    });

    if (previewBlock) {
      await this.prisma.contentBlock.update({
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
    const imageBlock = section.contentBlocks.find(b => b.blockType === 'image');

    if (!imageBlock) {
      throw new NotFoundException('Image block not found');
    }

    // Get title for context
    const titleBlock = section.contentBlocks.find(b => {
      try {
        const content = JSON.parse(b.contentJson);
        return content.isTitle === true;
      } catch {
        return false;
      }
    });

    const currentContent = titleBlock ? JSON.parse(titleBlock.contentJson) : { text: '' };
    const title = currentContent.text || 'Article';

    // Generate new image
    const imagePrompt = `Professional, high-quality image for article: ${title}`;
    console.log(`🎨 Generating image with prompt: ${imagePrompt.substring(0, 80)}...`);
    
    const imageUrl = await this.aiService.generateImage(imagePrompt);
    console.log(`✅ New image generated: ${imageUrl}`);

    // Update image block
    return this.prisma.contentBlock.update({
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
      throw new ForbiddenException('Cannot delete the hero section. You can only regenerate it.');
    }

    console.log(`🗑️  Deleting section ${sectionId}`);

    // Delete all content blocks first (due to foreign key constraints)
    await this.prisma.contentBlock.deleteMany({
      where: { sectionId },
    });

    // Delete the section
    await this.prisma.section.delete({
      where: { id: sectionId },
    });

    console.log(`✅ Section deleted successfully`);

    return { success: true, message: 'Blog deleted successfully' };
  }

  private async getSectionWithOwnership(sectionId: string) {
    const section = await this.prisma.section.findUnique({
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
      throw new NotFoundException('Section not found');
    }

    return section;
  }

  private async verifySectionOwnership(section: any, userId: string, userRole: string) {
    const ownerId = section.page.website.domain.userId;
    
    if (userRole !== 'SUPER_ADMIN' && ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async getBlockWithOwnership(blockId: string) {
    const block = await this.prisma.contentBlock.findUnique({
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
      throw new NotFoundException('Content block not found');
    }

    return block;
  }

  private async verifyOwnership(block: any, userId: string, userRole: string) {
    const ownerId = block.section.page.website.domain.userId;
    
    if (userRole !== 'SUPER_ADMIN' && ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }
}

