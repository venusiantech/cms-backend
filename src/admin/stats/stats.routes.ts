import { Router } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import prisma from '../../config/prisma';

const router = Router();

// GET /admin/stats
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [totalUsers, totalDomains, totalWebsites, totalLeads, totalPrompts, recentUsers, recentDomains] =
      await Promise.all([
        prisma.user.count(),
        prisma.domain.count(),
        prisma.website.count(),
        prisma.lead.count(),
        prisma.aiPrompt.count(),
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, email: true, role: true, createdAt: true },
        }),
        prisma.domain.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true } } },
        }),
      ]);

    res.json({
      totalUsers,
      totalDomains,
      totalWebsites,
      totalLeads,
      totalPrompts,
      recentUsers,
      recentDomains,
    });
  })
);

export default router;
