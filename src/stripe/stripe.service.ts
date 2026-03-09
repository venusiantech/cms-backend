import prisma from '../config/prisma';
import { stripe } from './stripe.client';
import { AppError } from '../middleware/error.middleware';

const SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL ||
  'https://fastofy.com/dashboard?subscription=success';
const CANCEL_URL =
  process.env.STRIPE_CANCEL_URL ||
  'https://fastofy.com/dashboard?subscription=cancelled';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodEnd(months = 1): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Ensure (or retrieve) the Stripe Customer for a user. */
async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const sub = await prisma.userSubscription.findUnique({ where: { userId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const customer = await stripe.customers.create({ email, metadata: { userId } });
  return customer.id;
}

// ─── Plan Queries ─────────────────────────────────────────────────────────────

export async function getActivePlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });
}

export async function getPlanById(planId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError('Plan not found', 404);
  return plan;
}

// ─── Assign Plan (admin & free) ───────────────────────────────────────────────

/**
 * Directly activate a subscription for a user — used for the Free plan on
 * registration, and when admin force-assigns a paid plan without Stripe checkout.
 *
 * Free plan credits are one-time only: granted when the subscription row is first
 * created (registration). Re-assigning the Free plan (e.g. after cancellation)
 * just updates the plan reference without touching the credit balance.
 */
export async function assignPlanDirectly(
  userId: string,
  planId: string,
): Promise<void> {
  const plan = await getPlanById(planId);
  const now = new Date();
  const isFree = plan.price === 0 && !plan.isCustom;

  const existing = await prisma.userSubscription.findUnique({ where: { userId } });

  if (existing) {
    // Free plan re-assignment: update plan reference only — no credit grant
    if (isFree) {
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          planId,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd(1),
          cancelAtPeriodEnd: false,
        },
      });
      console.log(`✅ [Subscription] User ${userId} reverted to Free plan — credits unchanged`);
      return;
    }

    // Paid plan: add new plan's credits on top of remaining (rollover)
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        planId,
        status: 'ACTIVE',
        creditsRemaining: { increment: plan.creditsPerMonth },
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd(1),
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    // Brand-new subscription — always grant credits (covers Free on registration)
    await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        creditsRemaining: plan.creditsPerMonth,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd(1),
      },
    });
  }

  // Log credit grant (only reached for new subscriptions or paid plan assignments)
  await prisma.creditLedger.create({
    data: {
      userId,
      amount: plan.creditsPerMonth,
      type: 'SUBSCRIPTION_CREDIT',
      description: `${plan.name} plan — ${plan.creditsPerMonth} credits granted`,
    },
  });

  console.log(`✅ [Subscription] User ${userId} assigned to plan "${plan.name}"`);
}

// ─── Stripe Checkout Session ──────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  email: string,
  planId: string,
): Promise<string> {
  const plan = await getPlanById(planId);

  if (!plan.stripePriceId) {
    throw new AppError(
      'This plan cannot be purchased directly. Contact support for a custom quote.',
      400,
    );
  }

  const customerId = await ensureStripeCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    metadata: { userId, planId },
    subscription_data: { metadata: { userId, planId } },
  });

  return session.url!;
}

// ─── Customer Portal ──────────────────────────────────────────────────────────

export async function createPortalSession(userId: string): Promise<string> {
  const sub = await prisma.userSubscription.findUnique({ where: { userId } });
  if (!sub?.stripeCustomerId) {
    throw new AppError('No active Stripe subscription found.', 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: SUCCESS_URL,
  });

  return session.url;
}

// ─── Custom Plan Payment Link ─────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout for a custom-priced plan.
 * Admin provides: userId to assign to, planId (a custom plan), and amountUsd.
 */
export async function createCustomPlanPaymentLink(
  userId: string,
  email: string,
  planId: string,
  amountUsd: number,
): Promise<string> {
  const plan = await getPlanById(planId);

  const customerId = await ensureStripeCustomer(userId, email);

  // Dynamically create a one-off Stripe price for this custom amount
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: Math.round(amountUsd * 100),
    recurring: { interval: 'month' },
    product_data: { name: `Fastofy ${plan.name}` },
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    metadata: { userId, planId },
    subscription_data: { metadata: { userId, planId } },
  });

  // Mark subscription as pending payment
  const existing = await prisma.userSubscription.findUnique({ where: { userId } });
  if (existing) {
    await prisma.userSubscription.update({
      where: { userId },
      data: { status: 'PENDING_PAYMENT', stripeCustomerId: customerId },
    });
  } else {
    await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: 'PENDING_PAYMENT',
        creditsRemaining: 0,
        stripeCustomerId: customerId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd(1),
      },
    });
  }

  return session.url!;
}

// ─── Ad-hoc Custom Plan (no pre-created plan record required) ────────────────

/**
 * Creates a one-off payment link for a specific user with custom pricing.
 * A hidden plan record is auto-created (isActive=false, isCustom=true) so the
 * webhook can grant the correct number of credits on payment — it won't appear
 * in any public plan lists.
 */
export async function createAdHocCustomPlan(
  userId: string,
  email: string,
  amountUsd: number,
  creditsPerMonth: number,
  maxWebsites: number,
  label?: string,
): Promise<string> {
  // Create a hidden plan just to carry credits/sites metadata for the webhook
  const planName = label?.trim() || `Custom (${email.split('@')[0]})`;
  const hiddenPlan = await prisma.subscriptionPlan.create({
    data: {
      name: planName,
      price: amountUsd,
      creditsPerMonth,
      maxWebsites,
      isCustom: true,
      isActive: false, // hidden from all public plan lists
    },
  });

  const customerId = await ensureStripeCustomer(userId, email);

  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: Math.round(amountUsd * 100),
    recurring: { interval: 'month' },
    product_data: { name: `Fastofy ${planName}` },
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    metadata: { userId, planId: hiddenPlan.id },
    subscription_data: { metadata: { userId, planId: hiddenPlan.id } },
  });

  // Mark subscription as pending payment
  const existing = await prisma.userSubscription.findUnique({ where: { userId } });
  if (existing) {
    await prisma.userSubscription.update({
      where: { userId },
      data: { status: 'PENDING_PAYMENT', stripeCustomerId: customerId },
    });
  } else {
    await prisma.userSubscription.create({
      data: {
        userId,
        planId: hiddenPlan.id,
        status: 'PENDING_PAYMENT',
        creditsRemaining: 0,
        stripeCustomerId: customerId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd(1),
      },
    });
  }

  return session.url!;
}

// ─── User Subscription Info ───────────────────────────────────────────────────

export async function getUserSubscription(userId: string) {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!sub) return null;

  const ledger = await prisma.creditLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return { ...sub, ledger };
}

// ─── Credit Deduction ─────────────────────────────────────────────────────────

export async function deductCredit(
  userId: string,
  description: string,
  domainId?: string,
): Promise<void> {
  const sub = await prisma.userSubscription.findUnique({ where: { userId } });
  if (!sub || sub.creditsRemaining <= 0) {
    throw new AppError('Insufficient credits', 402);
  }

  await prisma.$transaction([
    prisma.userSubscription.update({
      where: { userId },
      data: { creditsRemaining: { decrement: 1 } },
    }),
    prisma.creditLedger.create({
      data: {
        userId,
        amount: -1,
        type: 'BLOG_GENERATION',
        description,
        domainId: domainId ?? null,
      },
    }),
  ]);
}

// ─── Free Plan ID Lookup ──────────────────────────────────────────────────────

export async function getFreePlanId(): Promise<string> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Free' } });
  if (!plan) throw new AppError('Free plan not found in DB. Run seed-plans.ts first.', 500);
  return plan.id;
}
