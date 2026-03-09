import { Resend } from 'resend';
import { render } from '@react-email/render';
import prisma from '../config/prisma';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { WebsiteReadyEmail } from './templates/WebsiteReadyEmail';
import { DomainDeletedEmail } from './templates/DomainDeletedEmail';
import { SubscriptionAssignedEmail } from './templates/SubscriptionAssignedEmail';
import { CustomPlanPaymentEmail } from './templates/CustomPlanPaymentEmail';
import { SubscriptionActivatedEmail } from './templates/SubscriptionActivatedEmail';
import { SubscriptionRenewalEmail } from './templates/SubscriptionRenewalEmail';
import { PaymentFailedEmail } from './templates/PaymentFailedEmail';
import { SubscriptionCancelledEmail } from './templates/SubscriptionCancelledEmail';
import { SubscriptionCancellingEmail } from './templates/SubscriptionCancellingEmail';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'app@fastofy.com';
const LOGO_URL = 'https://fastofy.com/logo/fastofy.png';

/** Fetch notification settings and build the full recipient list for a user. */
async function getRecipients(
  userId: string,
  primaryEmail: string,
): Promise<{ allowed: boolean; to: string[] }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotificationsEnabled: true, notificationEmails: true },
    });

    if (!user || !user.emailNotificationsEnabled) {
      return { allowed: false, to: [] };
    }

    const extras = (user.notificationEmails ?? []).filter(
      (e) => e && e !== primaryEmail,
    );

    return { allowed: true, to: [primaryEmail, ...extras] };
  } catch {
    // On any DB error, fall back to sending only to the primary address
    return { allowed: true, to: [primaryEmail] };
  }
}

class EmailService {
  async sendWelcome(userId: string, to: string): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);

      if (!allowed) {
        console.log(`ℹ️  [Email] Welcome email skipped (notifications disabled) for ${to}`);
        return;
      }

      const html = await render(WelcomeEmail({ email: to, logoUrl: LOGO_URL }));
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: 'Welcome to Fastofy!',
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send welcome email to ${to}:`, error.message);
        return;
      }

      console.log(`✅ [Email] Welcome email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending welcome email to ${to}:`, err.message);
    }
  }

  async sendWebsiteReady(
    userId: string,
    to: string,
    domainName: string,
    subdomain: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);

      if (!allowed) {
        console.log(`ℹ️  [Email] Website-ready email skipped (notifications disabled) for ${to}`);
        return;
      }

      const html = await render(
        WebsiteReadyEmail({ email: to, domainName, subdomain, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `Your website for ${domainName} is ready!`,
        html,
      });

      if (error) {
        console.error(
          `⚠️  [Email] Failed to send website-ready email to ${to}:`,
          error.message,
        );
        return;
      }

      console.log(
        `✅ [Email] Website-ready email sent to ${recipients.join(', ')} for ${domainName}`,
      );
    } catch (err: any) {
      console.error(
        `⚠️  [Email] Exception sending website-ready email to ${to}:`,
        err.message,
      );
    }
  }

  async sendDomainDeleted(
    userId: string,
    to: string,
    domainName: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);

      if (!allowed) {
        console.log(`ℹ️  [Email] Domain-deleted email skipped (notifications disabled) for ${to}`);
        return;
      }

      const html = await render(
        DomainDeletedEmail({ email: to, domainName, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `${domainName} has been removed from Fastofy`,
        html,
      });

      if (error) {
        console.error(
          `⚠️  [Email] Failed to send domain-deleted email to ${to}:`,
          error.message,
        );
        return;
      }

      console.log(
        `✅ [Email] Domain-deleted email sent to ${recipients.join(', ')} for ${domainName}`,
      );
    } catch (err: any) {
      console.error(
        `⚠️  [Email] Exception sending domain-deleted email to ${to}:`,
        err.message,
      );
    }
  }

  async sendSubscriptionAssigned(
    userId: string,
    to: string,
    planName: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        SubscriptionAssignedEmail({ email: to, planName, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `You've been assigned the ${planName} plan on Fastofy`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send subscription-assigned email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Subscription-assigned email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending subscription-assigned email:`, err.message);
    }
  }

  async sendCustomPlanPayment(
    userId: string,
    to: string,
    planName: string,
    paymentUrl: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        CustomPlanPaymentEmail({ email: to, planName, paymentUrl, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `Your custom Fastofy plan is ready — Pay now to activate`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send custom-plan-payment email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Custom-plan-payment email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending custom-plan-payment email:`, err.message);
    }
  }

  async sendSubscriptionActivated(
    userId: string,
    to: string,
    planName: string,
    amountPaid: number,
    creditsAdded: number,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        SubscriptionActivatedEmail({ email: to, planName, amountPaid, creditsAdded, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `Your ${planName} subscription is now active!`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send subscription-activated email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Subscription-activated email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending subscription-activated email:`, err.message);
    }
  }

  async sendSubscriptionRenewal(
    userId: string,
    to: string,
    planName: string,
    amountPaid: number,
    creditsAdded: number,
    nextRenewalDate: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        SubscriptionRenewalEmail({ email: to, planName, amountPaid, creditsAdded, nextRenewalDate, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `${planName} renewed — ${creditsAdded} credits added`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send subscription-renewal email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Subscription-renewal email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending subscription-renewal email:`, err.message);
    }
  }

  async sendPaymentFailed(
    userId: string,
    to: string,
    planName: string,
    amountDue: number,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        PaymentFailedEmail({ email: to, planName, amountDue, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `Action required: Payment failed for your ${planName} plan`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send payment-failed email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Payment-failed email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending payment-failed email:`, err.message);
    }
  }

  async sendSubscriptionCancelled(
    userId: string,
    to: string,
    planName: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        SubscriptionCancelledEmail({ email: to, planName, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `Your ${planName} subscription has been cancelled`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send subscription-cancelled email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Subscription-cancelled email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending subscription-cancelled email:`, err.message);
    }
  }

  async sendSubscriptionCancelling(
    userId: string,
    to: string,
    planName: string,
    endsOn: string,
  ): Promise<void> {
    try {
      const { allowed, to: recipients } = await getRecipients(userId, to);
      if (!allowed) return;

      const html = await render(
        SubscriptionCancellingEmail({ email: to, planName, endsOn, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: recipients,
        subject: `Your ${planName} subscription will end on ${endsOn}`,
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send subscription-cancelling email:`, error.message);
        return;
      }
      console.log(`✅ [Email] Subscription-cancelling email sent to ${recipients.join(', ')}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending subscription-cancelling email:`, err.message);
    }
  }
}

export const emailService = new EmailService();
