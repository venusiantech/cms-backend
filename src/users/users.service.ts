import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { CloudflareService } from '../cloudflare-service/cloudflare.service';

const cloudflareService = new CloudflareService();

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

    // Collect all Cloudflare zone IDs before cascade delete removes them
    const domains = await prisma.domain.findMany({
      where: { userId: id },
      select: { cloudflareZoneId: true, domainName: true },
    });

    // Delete user (cascade removes all domains, websites, content, leads)
    await prisma.user.delete({ where: { id } });

    // Remove all Cloudflare zones non-blocking
    const zoneIds = domains
      .filter((d) => d.cloudflareZoneId)
      .map((d) => d.cloudflareZoneId as string);

    if (zoneIds.length > 0) {
      console.log(`🗑️  Cleaning up ${zoneIds.length} Cloudflare zone(s) for deleted user ${id}`);
      Promise.all(zoneIds.map((zoneId) => cloudflareService.deleteZone(zoneId))).catch((err) => {
        console.error(`⚠️  Cloudflare zone cleanup failed for user ${id}:`, err.message);
      });
    }

    return { message: 'User deleted successfully' };
  }
}
