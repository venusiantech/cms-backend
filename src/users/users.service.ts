import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { CloudflareService } from '../cloudflare-service/cloudflare.service';
import { StorageService } from '../storage/storage.service';

const cloudflareService = new CloudflareService();
const storageService = new StorageService();

interface UpdateProfileDto {
  name?: string;
  firstName?: string;
  lastName?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  emailNotificationsEnabled?: boolean;
  notificationEmails?: string[];
}

export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        dateOfBirth: true,
        emailNotificationsEnabled: true,
        notificationEmails: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (dto.notificationEmails !== undefined && dto.notificationEmails.length > 2) {
      throw new AppError('A maximum of 2 notification email addresses are allowed', 400);
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.mobileNumber !== undefined && { mobileNumber: dto.mobileNumber }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
        ...(dto.emailNotificationsEnabled !== undefined && {
          emailNotificationsEnabled: dto.emailNotificationsEnabled,
        }),
        ...(dto.notificationEmails !== undefined && {
          notificationEmails: dto.notificationEmails,
        }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        dateOfBirth: true,
        emailNotificationsEnabled: true,
        notificationEmails: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async updateRole(id: string, role: UserRole) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Collect Cloudflare zone IDs + all storage assets BEFORE cascade delete
    const domains = await prisma.domain.findMany({
      where: { userId: id },
      select: {
        cloudflareZoneId: true,
        domainName: true,
        website: {
          select: {
            websiteLogoKey: true,
            pages: {
              select: {
                sections: {
                  select: {
                    contentBlocks: {
                      where: { blockType: 'image' },
                      select: { contentJson: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Flatten all storage assets across all domains
    const storageAssets: string[] = [];
    for (const domain of domains) {
      if (domain.website?.websiteLogoKey) {
        storageAssets.push(domain.website.websiteLogoKey);
      }
      for (const page of domain.website?.pages ?? []) {
        for (const section of page.sections) {
          for (const block of section.contentBlocks) {
            try {
              const content = JSON.parse(block.contentJson);
              if (content?.url) storageAssets.push(content.url);
            } catch {
              // malformed JSON — skip
            }
          }
        }
      }
    }

    // Delete user (cascade removes all domains, websites, content, leads)
    await prisma.user.delete({ where: { id } });

    // --- Non-blocking cleanup ---

    // 1. Remove all Cloudflare zones
    const zoneIds = domains
      .filter((d) => d.cloudflareZoneId)
      .map((d) => d.cloudflareZoneId as string);

    if (zoneIds.length > 0) {
      console.log(`🗑️  Cleaning up ${zoneIds.length} Cloudflare zone(s) for deleted user ${id}`);
      Promise.all(zoneIds.map((zoneId) => cloudflareService.deleteZone(zoneId))).catch((err) => {
        console.error(`⚠️  Cloudflare zone cleanup failed for user ${id}:`, err.message);
      });
    }

    // 2. Remove all stored images from S3/Cloudinary
    if (storageAssets.length > 0) {
      console.log(`🗑️  Deleting ${storageAssets.length} stored image(s) for deleted user ${id}`);
      Promise.allSettled(
        storageAssets.map((asset) => storageService.deleteFileByUrl(asset))
      ).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          console.error(`⚠️  ${failed} storage asset(s) failed to delete for user ${id}`);
        } else {
          console.log(`✅ All storage assets deleted for user ${id}`);
        }
      });
    }

    return { message: 'User deleted successfully' };
  }
}
