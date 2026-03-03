import { Resend } from 'resend';
import { render } from '@react-email/render';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { WebsiteReadyEmail } from './templates/WebsiteReadyEmail';
import { DomainDeletedEmail } from './templates/DomainDeletedEmail';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'app@fastofy.com';
const LOGO_URL = 'https://fastofy.com/logo/fastofy.png';

class EmailService {
  async sendWelcome(to: string, userId: string): Promise<void> {
    try {
      const html = await render(WelcomeEmail({ email: to, logoUrl: LOGO_URL }));
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: [to],
        subject: 'Welcome to Fastofy!',
        html,
      });

      if (error) {
        console.error(`⚠️  [Email] Failed to send welcome email to ${to}:`, error.message);
        return;
      }

      console.log(`✅ [Email] Welcome email sent to ${to}`);
    } catch (err: any) {
      console.error(`⚠️  [Email] Exception sending welcome email to ${to}:`, err.message);
    }
  }

  async sendWebsiteReady(
    to: string,
    domainName: string,
    subdomain: string,
  ): Promise<void> {
    try {
      const html = await render(
        WebsiteReadyEmail({ email: to, domainName, subdomain, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: [to],
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

      console.log(`✅ [Email] Website-ready email sent to ${to} for ${domainName}`);
    } catch (err: any) {
      console.error(
        `⚠️  [Email] Exception sending website-ready email to ${to}:`,
        err.message,
      );
    }
  }

  async sendDomainDeleted(
    to: string,
    domainName: string,
  ): Promise<void> {
    try {
      const html = await render(
        DomainDeletedEmail({ email: to, domainName, logoUrl: LOGO_URL }),
      );
      const { error } = await resend.emails.send({
        from: `Fastofy <${FROM}>`,
        to: [to],
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

      console.log(`✅ [Email] Domain-deleted email sent to ${to} for ${domainName}`);
    } catch (err: any) {
      console.error(
        `⚠️  [Email] Exception sending domain-deleted email to ${to}:`,
        err.message,
      );
    }
  }
}

export const emailService = new EmailService();
