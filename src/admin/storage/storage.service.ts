import prisma from '../../config/prisma';
import { AppError } from '../../middleware/error.middleware';

export class AdminStorageService {
  /**
   * Get storage overview grouped by website
   */
  async getStorageOverview() {
    const websites = await prisma.website.findMany({
      include: {
        domain: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
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
      orderBy: { createdAt: 'desc' },
    });

    return websites.map((website) => {
      const allBlocks = website.pages.flatMap((p) =>
        p.sections.flatMap((s) => s.contentBlocks)
      );

      const textBlocks = allBlocks.filter((b) => b.blockType === 'text');
      const imageBlocks = allBlocks.filter((b) => b.blockType === 'image');

      // Count blog sections (a blog = 1 section with title + content + preview + image)
      const blogSections = website.pages.flatMap((p) =>
        p.sections.filter((s) => s.sectionType === 'content')
      );

      // Calculate text size in bytes
      const textSizeBytes = textBlocks.reduce(
        (sum, b) => sum + Buffer.byteLength(b.contentJson, 'utf8'),
        0
      );

      // Image blocks — count only (actual size is on S3)
      const imageCount = imageBlocks.length;

      return {
        websiteId: website.id,
        domainName: website.domain.domainName,
        subdomain: website.subdomain,
        userEmail: website.domain.user.email,
        userId: website.domain.user.id,
        templateKey: website.templateKey,
        createdAt: website.createdAt,
        stats: {
          totalBlogs: blogSections.length,
          totalTextBlocks: textBlocks.length,
          totalImages: imageCount,
          totalBlocks: allBlocks.length,
          textSizeBytes,
          textSizeKb: Math.round(textSizeBytes / 1024),
        },
      };
    });
  }

  /**
   * Get detailed storage for one website (all blogs + images listed)
   */
  async getWebsiteStorage(websiteId: string) {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        domain: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
        pages: {
          include: {
            sections: {
              orderBy: { orderIndex: 'desc' },
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

    if (!website) throw new AppError('Website not found', 404);

    const blogs = website.pages.flatMap((page) =>
      page.sections
        .filter((s) => s.sectionType === 'content')
        .map((section) => {
          const blocks = section.contentBlocks;
          const titleBlock = blocks.find((b) => {
            try { return JSON.parse(b.contentJson).isTitle; } catch { return false; }
          });
          const contentBlock = blocks.find((b) => {
            try { return JSON.parse(b.contentJson).isFullContent; } catch { return false; }
          });
          const imageBlock = blocks.find((b) => b.blockType === 'image');

          const title = titleBlock ? JSON.parse(titleBlock.contentJson).text : 'Untitled';
          const imageUrl = imageBlock ? JSON.parse(imageBlock.contentJson).url : null;
          const contentSize = contentBlock
            ? Buffer.byteLength(contentBlock.contentJson, 'utf8')
            : 0;

          return {
            sectionId: section.id,
            orderIndex: section.orderIndex,
            createdAt: section.createdAt,
            title,
            imageUrl,
            contentSizeBytes: contentSize,
            contentSizeKb: Math.round(contentSize / 1024),
            blockCount: blocks.length,
            blocks: blocks.map((b) => ({
              id: b.id,
              blockType: b.blockType,
              sizeBytes: Buffer.byteLength(b.contentJson, 'utf8'),
              createdAt: b.createdAt,
            })),
          };
        })
    );

    const totalTextSize = blogs.reduce((sum, b) => sum + b.contentSizeBytes, 0);

    return {
      websiteId: website.id,
      domainName: website.domain.domainName,
      subdomain: website.subdomain,
      userEmail: website.domain.user.email,
      stats: {
        totalBlogs: blogs.length,
        totalImages: blogs.filter((b) => b.imageUrl).length,
        totalTextSizeBytes: totalTextSize,
        totalTextSizeKb: Math.round(totalTextSize / 1024),
      },
      blogs,
    };
  }

  /**
   * Delete an entire blog section (removes all its content blocks)
   */
  async deleteBlogSection(sectionId: string) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { contentBlocks: true },
    });

    if (!section) throw new AppError('Section not found', 404);

    // Delete all content blocks first, then the section
    await prisma.$transaction([
      prisma.contentBlock.deleteMany({ where: { sectionId } }),
      prisma.section.delete({ where: { id: sectionId } }),
    ]);

    return {
      success: true,
      message: `Blog section deleted (${section.contentBlocks.length} blocks removed)`,
    };
  }

  /**
   * Delete a single content block
   */
  async deleteBlock(blockId: string) {
    const block = await prisma.contentBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new AppError('Content block not found', 404);

    await prisma.contentBlock.delete({ where: { id: blockId } });

    return { success: true, message: 'Content block deleted' };
  }

  /**
   * Delete ALL blog content for a website (keeps the website/pages structure intact)
   */
  async deleteAllWebsiteContent(websiteId: string) {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        pages: {
          include: {
            sections: {
              where: { sectionType: 'content' },
              include: { contentBlocks: true },
            },
          },
        },
      },
    });

    if (!website) throw new AppError('Website not found', 404);

    const contentSections = website.pages.flatMap((p) => p.sections);
    const sectionIds = contentSections.map((s) => s.id);
    const totalBlocks = contentSections.reduce((sum, s) => sum + s.contentBlocks.length, 0);

    await prisma.$transaction([
      prisma.contentBlock.deleteMany({ where: { sectionId: { in: sectionIds } } }),
      prisma.section.deleteMany({ where: { id: { in: sectionIds } } }),
    ]);

    return {
      success: true,
      message: `All content deleted: ${contentSections.length} blog sections, ${totalBlocks} blocks removed`,
    };
  }
}
