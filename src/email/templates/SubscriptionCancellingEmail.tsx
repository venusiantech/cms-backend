import * as React from 'react';
import {
  Body, Container, Head, Heading, Html, Img, Preview,
  Section, Text, Hr, Link,
} from '@react-email/components';

interface Props {
  email: string;
  planName: string;
  endsOn: string;
  logoUrl: string;
}

export function SubscriptionCancellingEmail({ email, planName, endsOn, logoUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your {planName} subscription will end on {endsOn}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img src={logoUrl} width="140" height="auto" alt="Fastofy" style={logo} />
            <Text style={brandName}>FASTOFY</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Subscription Cancellation Scheduled</Heading>
            <Text style={paragraph}>Hi there,</Text>
            <Text style={paragraph}>
              You've requested to cancel your <strong>{planName}</strong> subscription.
              You'll retain full access to all features until your billing period ends.
            </Text>

            <Section style={warningBox}>
              <Text style={warningLabel}>Access ends on</Text>
              <Text style={warningDate}>{endsOn}</Text>
            </Section>

            <Text style={paragraph}>
              After that date, you'll be automatically moved to the Free plan.
              Changed your mind? You can reactivate anytime before the end date — no setup required.
            </Text>

            <Link href="https://fastofy.com/dashboard/settings" style={button}>
              Reactivate Subscription →
            </Link>

            <Text style={subText}>
              If you didn't request this cancellation, please contact support immediately.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>© {new Date().getFullYear()} Fastofy. All rights reserved.</Text>
            <Text style={footerText}>
              <Link href="https://fastofy.com" style={footerLink}>fastofy.com</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0, padding: '32px 0',
};
const container: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '8px', maxWidth: '560px',
  margin: '0 auto', overflow: 'hidden',
};
const header: React.CSSProperties = { backgroundColor: '#0f172a', padding: '24px 32px', textAlign: 'center' };
const logo: React.CSSProperties = { display: 'block', margin: '0 auto' };
const brandName: React.CSSProperties = {
  color: '#ffffff', fontSize: '22px', fontWeight: '800',
  letterSpacing: '0.12em', textAlign: 'center', margin: '10px 0 0',
};
const content: React.CSSProperties = { padding: '32px 40px' };
const h1: React.CSSProperties = { color: '#0f172a', fontSize: '24px', fontWeight: '700', margin: '0 0 24px' };
const paragraph: React.CSSProperties = { color: '#374151', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' };
const warningBox: React.CSSProperties = {
  backgroundColor: '#fff7ed', borderLeft: '4px solid #ea580c',
  borderRadius: '4px', padding: '16px 20px', margin: '24px 0', textAlign: 'center',
};
const warningLabel: React.CSSProperties = { color: '#9a3412', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' };
const warningDate: React.CSSProperties = { color: '#c2410c', fontSize: '22px', fontWeight: '700', margin: '0' };
const button: React.CSSProperties = {
  backgroundColor: '#ea580c', borderRadius: '6px', color: '#ffffff',
  display: 'inline-block', fontSize: '14px', fontWeight: '600',
  padding: '12px 24px', textDecoration: 'none', margin: '8px 0 24px',
};
const subText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '16px 0 0' };
const divider: React.CSSProperties = { borderColor: '#e5e7eb', margin: '0' };
const footer: React.CSSProperties = { padding: '20px 40px', textAlign: 'center' };
const footerText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '4px 0' };
const footerLink: React.CSSProperties = { color: '#9ca3af', textDecoration: 'underline' };
