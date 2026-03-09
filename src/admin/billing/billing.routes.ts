import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler, AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import prisma from '../../config/prisma';
import { assignPlanDirectly, createCustomPlanPaymentLink, createAdHocCustomPlan } from '../../stripe/stripe.service';
import { emailService } from '../../email/email.service';

const router = Router();

// ─── Plans CRUD ───────────────────────────────────────────────────────────────

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
    res.json(plans);
  }),
);

router.post(
  '/plans',
  validate([
    body('name').isString().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('creditsPerMonth').isInt({ min: 0 }),
    body('maxWebsites').isInt({ min: 0 }),
    body('isCustom').optional().isBoolean(),
  ]),
  asyncHandler(async (req, res) => {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: req.body.name,
        price: req.body.price,
        creditsPerMonth: req.body.creditsPerMonth,
        maxWebsites: req.body.maxWebsites,
        isCustom: req.body.isCustom ?? false,
      },
    });
    res.status(201).json(plan);
  }),
);

router.put(
  '/plans/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.name !== undefined && { name: req.body.name }),
        ...(req.body.price !== undefined && { price: req.body.price }),
        ...(req.body.creditsPerMonth !== undefined && { creditsPerMonth: req.body.creditsPerMonth }),
        ...(req.body.maxWebsites !== undefined && { maxWebsites: req.body.maxWebsites }),
        ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
        ...(req.body.stripePriceId !== undefined && { stripePriceId: req.body.stripePriceId }),
      },
    });
    res.json(plan);
  }),
);

router.delete(
  '/plans/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Plan deactivated' });
  }),
);

// ─── User Subscription Management ────────────────────────────────────────────

router.get(
  '/users/:userId/subscription',
  validate([param('userId').isUUID()]),
  asyncHandler(async (req, res) => {
    const sub = await prisma.userSubscription.findUnique({
      where: { userId: req.params.userId },
      include: { plan: true },
    });

    const ledger = await prisma.creditLedger.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const payments = await prisma.paymentRecord.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ subscription: sub, ledger, payments });
  }),
);

/**
 * Assign a plan to a user.
 * Body: { planId, amountUsd? }
 * - Free / paid plans with stripePriceId → activate immediately + send confirmation email
 * - Custom plans (isCustom=true) → generate Stripe payment link + send payment email
 */
router.post(
  '/users/:userId/subscription',
  validate([
    param('userId').isUUID(),
    body('planId').isUUID().withMessage('Invalid plan ID'),
    body('amountUsd').optional().isFloat({ min: 0.5 }),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const { userId } = req.params;
    const { planId, amountUsd } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError('Plan not found', 404);

    if (plan.isCustom) {
      if (!amountUsd) {
        throw new AppError('amountUsd is required for custom plans', 400);
      }

      const paymentUrl = await createCustomPlanPaymentLink(
        userId,
        user.email,
        planId,
        amountUsd,
      );

      emailService.sendCustomPlanPayment(userId, user.email, plan.name, paymentUrl);

      res.json({
        message: 'Payment link created and emailed to user',
        paymentUrl,
      });
    } else {
      await assignPlanDirectly(userId, planId);
      emailService.sendSubscriptionAssigned(userId, user.email, plan.name);

      res.json({ message: `${plan.name} plan assigned successfully` });
    }
  }),
);

// ─── Ad-hoc Custom Plan ───────────────────────────────────────────────────────

/**
 * Assign a fully custom plan to a user without pre-creating a plan.
 * Body: { amountUsd, creditsPerMonth, maxWebsites, label? }
 * Creates a hidden plan record + Stripe payment link, then emails the user.
 */
router.post(
  '/users/:userId/custom-plan',
  validate([
    param('userId').isUUID(),
    body('amountUsd').isFloat({ min: 0.5 }),
    body('creditsPerMonth').isInt({ min: 1 }),
    body('maxWebsites').isInt({ min: 1 }),
    body('label').optional().isString(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const { userId } = req.params;
    const { amountUsd, creditsPerMonth, maxWebsites, label } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const paymentUrl = await createAdHocCustomPlan(
      userId,
      user.email,
      amountUsd,
      creditsPerMonth,
      maxWebsites,
      label,
    );

    emailService.sendCustomPlanPayment(userId, user.email, label || 'Custom Plan', paymentUrl);

    res.json({ message: 'Payment link created and emailed to user', paymentUrl });
  }),
);

// ─── Admin credit ledger overview ─────────────────────────────────────────────

router.get(
  '/credits',
  asyncHandler(async (_req, res) => {
    const ledger = await prisma.creditLedger.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { email: true } },
      },
    });
    res.json(ledger);
  }),
);

// ─── Custom Plan Requests ─────────────────────────────────────────────────────

router.get(
  '/custom-plan-requests',
  asyncHandler(async (_req, res) => {
    const requests = await prisma.customPlanRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    res.json(requests);
  }),
);

router.patch(
  '/custom-plan-requests/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const existing = await prisma.customPlanRequest.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!existing) throw new AppError('Request not found', 404);

    const updated = await prisma.customPlanRequest.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.status !== undefined && { status: req.body.status }),
        ...(req.body.adminNote !== undefined && { adminNote: req.body.adminNote }),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // Send email when status first changes to REVIEWED
    if (req.body.status === 'REVIEWED' && existing.status !== 'REVIEWED') {
      emailService.sendCustomPlanRequestReviewed(existing.user.id, existing.user.email);
    }

    res.json(updated);
  }),
);

export default router;
