import Stripe from 'stripe';
import prisma from '../config/prisma';
import { assignPlanDirectly } from './stripe.service';

// ─── checkout.session.completed ──────────────────────────────────────────────

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { userId, planId } = session.metadata ?? {};
  if (!userId || !planId) {
    console.warn('⚠️  [Webhook] checkout.session.completed missing metadata');
    return;
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    console.warn(`⚠️  [Webhook] Plan ${planId} not found`);
    return;
  }

  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const existing = await prisma.userSubscription.findUnique({ where: { userId } });

  if (existing) {
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        planId,
        status: 'ACTIVE',
        creditsRemaining: { increment: plan.creditsPerMonth },
        stripeCustomerId: stripeCustomerId ?? existing.stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId ?? existing.stripeSubscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        creditsRemaining: plan.creditsPerMonth,
        stripeCustomerId: stripeCustomerId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  // Log credit grant
  await prisma.creditLedger.create({
    data: {
      userId,
      amount: plan.creditsPerMonth,
      type: 'SUBSCRIPTION_CREDIT',
      description: `${plan.name} plan activated — ${plan.creditsPerMonth} credits`,
    },
  });

  // Record payment
  await prisma.paymentRecord.create({
    data: {
      userId,
      stripeCheckoutId: session.id,
      amount: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? 'usd',
      status: 'SUCCEEDED',
      planId,
    },
  });

  console.log(`✅ [Webhook] Subscription activated for user ${userId} — plan "${plan.name}"`);
}

// ─── invoice.payment_succeeded ────────────────────────────────────────────────

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const sub = await prisma.userSubscription.findFirst({
    where: { stripeCustomerId: customerId },
    include: { plan: true },
  });

  if (!sub) {
    console.warn(`⚠️  [Webhook] No subscription found for customer ${customerId}`);
    return;
  }

  // Skip the very first invoice (already handled by checkout.session.completed)
  if (invoice.billing_reason === 'subscription_create') return;

  // Free plan has no Stripe subscription — should never reach here, but guard anyway
  if (sub.plan.price === 0 && !sub.plan.isCustom) {
    console.log(`ℹ️  [Webhook] Skipping monthly credit rollover for Free plan user ${sub.userId}`);
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Rollover: add monthly credits on top of remaining balance
  await prisma.userSubscription.update({
    where: { userId: sub.userId },
    data: {
      status: 'ACTIVE',
      creditsRemaining: { increment: sub.plan.creditsPerMonth },
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await prisma.creditLedger.create({
    data: {
      userId: sub.userId,
      amount: sub.plan.creditsPerMonth,
      type: 'SUBSCRIPTION_CREDIT',
      description: `Monthly renewal — ${sub.plan.creditsPerMonth} credits added (rollover)`,
    },
  });

  await prisma.paymentRecord.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: { status: 'SUCCEEDED' },
    create: {
      userId: sub.userId,
      stripeInvoiceId: invoice.id,
      amount: (invoice.amount_paid ?? 0) / 100,
      currency: invoice.currency ?? 'usd',
      status: 'SUCCEEDED',
      planId: sub.planId,
    },
  });

  console.log(
    `✅ [Webhook] Monthly renewal for user ${sub.userId} — ${sub.plan.creditsPerMonth} credits added`,
  );
}

// ─── invoice.payment_failed ───────────────────────────────────────────────────

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const sub = await prisma.userSubscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!sub) return;

  await prisma.userSubscription.update({
    where: { userId: sub.userId },
    data: { status: 'PENDING_PAYMENT' },
  });

  await prisma.paymentRecord.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: { status: 'FAILED' },
    create: {
      userId: sub.userId,
      stripeInvoiceId: invoice.id,
      amount: (invoice.amount_due ?? 0) / 100,
      currency: invoice.currency ?? 'usd',
      status: 'FAILED',
      planId: sub.planId,
    },
  });

  console.warn(`⚠️  [Webhook] Payment failed for user ${sub.userId}`);
}

// ─── customer.subscription.updated ───────────────────────────────────────────

export async function handleSubscriptionUpdated(
  stripeSub: Stripe.Subscription,
): Promise<void> {
  const sub = await prisma.userSubscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (!sub) return;

  const cancelAtPeriodEnd = stripeSub.cancel_at_period_end ?? false;
  const periodEndTs = (stripeSub as any).current_period_end;
  const currentPeriodEnd = periodEndTs ? new Date(periodEndTs * 1000) : undefined;

  await prisma.userSubscription.update({
    where: { userId: sub.userId },
    data: {
      cancelAtPeriodEnd,
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
    },
  });

  console.log(
    `✅ [Webhook] Subscription updated for user ${sub.userId} — cancelAtPeriodEnd: ${cancelAtPeriodEnd}`,
  );
}

// ─── customer.subscription.deleted ───────────────────────────────────────────

export async function handleSubscriptionDeleted(
  stripeSub: Stripe.Subscription,
): Promise<void> {
  const sub = await prisma.userSubscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (!sub) return;

  // Revert to Free plan
  try {
    const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Free' } });
    if (freePlan) {
      await assignPlanDirectly(sub.userId, freePlan.id);
    }
  } catch (_) {
    // If free plan isn't seeded, just cancel
  }

  await prisma.userSubscription.update({
    where: { userId: sub.userId },
    data: {
      status: 'CANCELLED',
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    },
  });

  console.log(`✅ [Webhook] Subscription cancelled for user ${sub.userId} — reverted to Free`);
}
