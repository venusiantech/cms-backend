/**
 * Run once to seed the default subscription plans.
 * Usage: ts-node -r dotenv/config src/stripe/seed-plans.ts
 */

import prisma from '../config/prisma';
import { stripe } from './stripe.client';

async function seedPlans() {
  console.log('🌱 Seeding subscription plans...');

  // ── Free plan (no Stripe product needed) ──────────────────────────────────
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Free' },
    update: {},
    create: {
      name: 'Free',
      price: 0,
      creditsPerMonth: 6,
      maxWebsites: 1,
      stripePriceId: null,
      isCustom: false,
    },
  });
  console.log(`✅ Free plan: ${freePlan.id}`);

  // ── Starter plan ──────────────────────────────────────────────────────────
  let starterPriceId: string | null = null;
  try {
    const starterProduct = await stripe.products.create({
      name: 'Fastofy Starter',
      description: '8 websites, 80 credits/month',
    });
    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 2000, // $20.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    starterPriceId = starterPrice.id;
    console.log(`✅ Starter Stripe price: ${starterPriceId}`);
  } catch (err: any) {
    console.warn(`⚠️  Could not create Starter Stripe price: ${err.message}`);
  }

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Starter' },
    update: { stripePriceId: starterPriceId },
    create: {
      name: 'Starter',
      price: 20,
      creditsPerMonth: 80,
      maxWebsites: 8,
      stripePriceId: starterPriceId,
      isCustom: false,
    },
  });
  console.log(`✅ Starter plan: ${starterPlan.id}`);

  // ── Business plan ─────────────────────────────────────────────────────────
  let businessPriceId: string | null = null;
  try {
    const businessProduct = await stripe.products.create({
      name: 'Fastofy Business',
      description: '100 websites, 350 credits/month',
    });
    const businessPrice = await stripe.prices.create({
      product: businessProduct.id,
      unit_amount: 10000, // $100.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    businessPriceId = businessPrice.id;
    console.log(`✅ Business Stripe price: ${businessPriceId}`);
  } catch (err: any) {
    console.warn(`⚠️  Could not create Business Stripe price: ${err.message}`);
  }

  const businessPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Business' },
    update: { stripePriceId: businessPriceId },
    create: {
      name: 'Business',
      price: 100,
      creditsPerMonth: 350,
      maxWebsites: 100,
      stripePriceId: businessPriceId,
      isCustom: false,
    },
  });
  console.log(`✅ Business plan: ${businessPlan.id}`);

  console.log('🎉 Seed complete!');
  await prisma.$disconnect();
}

seedPlans().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
