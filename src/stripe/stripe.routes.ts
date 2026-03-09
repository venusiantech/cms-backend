import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { stripe } from './stripe.client';
import prisma from '../config/prisma';
import {
  getActivePlans,
  getUserSubscription,
  createCheckoutSession,
  createPortalSession,
} from './stripe.service';
import {
  handleCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from './stripe-webhook.service';

const router = Router();

// ─── Public: list plans ───────────────────────────────────────────────────────
router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await getActivePlans();
    res.json(plans);
  }),
);

// ─── Webhook (must be before express.json — uses raw body) ────────────────────
router.post(
  '/webhook',
  (req: Request, res: Response, next: NextFunction) => {
    // body already set as raw buffer in server.ts for this path
    next();
  },
  asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new AppError('Webhook secret not configured', 500);
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody ?? req.body,
        sig,
        secret,
      );
    } catch (err: any) {
      console.error('⚠️  [Webhook] Signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as any);
          break;
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object as any);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as any);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as any);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as any);
          break;
        default:
          console.log(`ℹ️  [Webhook] Unhandled event: ${event.type}`);
      }
    } catch (err: any) {
      console.error(`❌ [Webhook] Handler error for ${event.type}:`, err.message);
      // Return 200 so Stripe doesn't retry on logic errors
    }

    res.json({ received: true });
  }),
);

// ─── Authenticated routes ─────────────────────────────────────────────────────
router.use(authenticate);

router.get(
  '/subscription',
  asyncHandler(async (req: AuthRequest, res) => {
    const data = await getUserSubscription(req.user!.id);
    res.json(data ?? { status: 'none' });
  }),
);

router.post(
  '/subscribe',
  validate([body('planId').isUUID().withMessage('Invalid plan ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const url = await createCheckoutSession(
      req.user!.id,
      req.user!.email,
      req.body.planId,
    );
    res.json({ url });
  }),
);

router.post(
  '/portal',
  asyncHandler(async (req: AuthRequest, res) => {
    const url = await createPortalSession(req.user!.id);
    res.json({ url });
  }),
);

// ─── Custom plan request ──────────────────────────────────────────────────────
router.post(
  '/custom-plan-request',
  validate([body('message').isString().notEmpty().withMessage('Message is required')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await prisma.customPlanRequest.create({
      data: {
        userId: req.user!.id,
        message: req.body.message,
      },
    });
    res.status(201).json({ message: 'Request submitted successfully', id: request.id });
  }),
);

router.get(
  '/custom-plan-request',
  asyncHandler(async (req: AuthRequest, res) => {
    const requests = await prisma.customPlanRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  }),
);

export default router;
