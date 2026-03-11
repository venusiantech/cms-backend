import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import prisma from '../config/prisma';

const router = Router();

router.use(authenticate);

/**
 * GET /api/dashboard
 * Returns subscription usage, aggregate counts, and 30-day chart data
 * for the authenticated user.
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 30 days inclusive
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Run all independent queries in parallel ─────────────────────────────

    const [
      subscription,
      domainCounts,
      websiteCount,
      leadCounts,
      totalBlogsGenerated,
      creditChartRaw,
      leadsChartRaw,
    ] = await Promise.all([

      // 1. Subscription + plan
      prisma.userSubscription.findUnique({
        where: { userId },
        include: { plan: true },
      }),

      // 2. Domain counts (total + active)
      prisma.domain.groupBy({
        by: ['status'],
        where: { userId },
        _count: { id: true },
      }),

      // 3. Active websites only (domain must be ACTIVE — excludes pending CSV uploads)
      prisma.website.count({
        where: {
          domain: { userId, status: 'ACTIVE' },
        },
      }),

      // 4. Lead counts — total + this month
      Promise.all([
        prisma.lead.count({
          where: { website: { domain: { userId } } },
        }),
        prisma.lead.count({
          where: {
            website: { domain: { userId } },
            createdAt: { gte: startOfMonth },
          },
        }),
      ]),

      // 5. All-time blogs generated (one ledger entry per blog)
      prisma.creditLedger.count({
        where: { userId, type: 'BLOG_GENERATION' },
      }),

      // 6. Credits used per day (last 30 days) — raw SQL for DATE_TRUNC grouping
      prisma.$queryRaw<{ day: Date; total: bigint }[]>`
        SELECT
          DATE_TRUNC('day', created_at) AS day,
          COUNT(*) AS total
        FROM credit_ledger
        WHERE user_id = ${userId}
          AND type = 'BLOG_GENERATION'
          AND created_at >= ${thirtyDaysAgo}
        GROUP BY day
        ORDER BY day ASC
      `,

      // 7. Leads per day (last 30 days)
      prisma.$queryRaw<{ day: Date; total: bigint }[]>`
        SELECT
          DATE_TRUNC('day', l.created_at) AS day,
          COUNT(*) AS total
        FROM leads l
        INNER JOIN websites w ON w.id = l.website_id
        INNER JOIN domains d ON d.id = w.domain_id
        WHERE d.user_id = ${userId}
          AND l.created_at >= ${thirtyDaysAgo}
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    // ── Flatten domain counts ───────────────────────────────────────────────
    let totalDomains = 0;
    let activeDomains = 0;
    for (const row of domainCounts) {
      totalDomains += row._count.id;
      if (row.status === 'ACTIVE') activeDomains += row._count.id;
    }

    const [totalLeads, leadsThisMonth] = leadCounts;

    // ── Build subscription block ────────────────────────────────────────────
    const subscriptionData = subscription
      ? {
          planName: subscription.plan.name,
          status: subscription.status,
          creditsRemaining: subscription.creditsRemaining,
          creditsPerMonth: subscription.plan.creditsPerMonth,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          websitesUsed: websiteCount,
          maxWebsites: subscription.plan.maxWebsites,
          isCustomPlan: subscription.plan.isCustom,
        }
      : null;

    // ── Fill chart arrays for all 30 days (zero-fill missing days) ──────────
    function buildDailyChart(
      raw: { day: Date; total: bigint }[],
    ): { date: string; value: number }[] {
      // Index raw data by ISO date string (YYYY-MM-DD)
      const map = new Map<string, number>();
      for (const row of raw) {
        const dateKey = row.day.toISOString().slice(0, 10);
        map.set(dateKey, Number(row.total));
      }

      const result: { date: string; value: number }[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, value: map.get(key) ?? 0 });
      }
      return result;
    }

    res.json({
      subscription: subscriptionData,
      counts: {
        domains: totalDomains,
        activeDomains,
        websites: websiteCount,
        totalBlogsGenerated,
        totalLeads,
        leadsThisMonth,
      },
      charts: {
        creditsUsed: buildDailyChart(creditChartRaw),
        blogsGenerated: buildDailyChart(creditChartRaw), // same source
        leads: buildDailyChart(leadsChartRaw),
      },
    });
  }),
);

export default router;
