import * as React from 'react';
import {
  Body, Container, Head, Heading, Html, Img, Preview,
  Section, Text, Hr, Link,
} from '@react-email/components';

interface Props {
  email: string;
  planName: string;
  amountDue: number;
  logoUrl: string;
}

export function PaymentFailedEmail({ email, planName, amountDue, logoUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Action required: Payment failed for your {planName} subscription</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img src={logoUrl} width="140" height="auto" alt="Fastofy" style={logo} />
            <Text style={brandName}>FASTOFY</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Payment Failed ⚠️</Heading>
            <Text style={paragraph}>Hi there,</Text>
            <Text style={paragraph}>
              We were unable to process your payment of{' '}
              <strong>${amountDue.toFixed(2)}</strong> for your{' '}
              <strong>{planName}</strong> subscription.
            </Text>

            <Section style={alertBox}>
              <Text style={alertText}>
                Your subscription is currently paused. Please update your payment method to restore access to your credits and features.
              </Text>
            </Section>

            <Text style={paragraph}>To fix this:</Text>
            <Text style={listItem}>1. Go to your subscription settings</Text>
            <Text style={listItem}>2. Click "Manage / Cancel Subscription"</Text>
            <Text style={listItem}>3. Update your payment method in the billing portal</Text>

            <Link href="https://fastofy.com/dashboard/settings" style={button}>
              Update Payment Method →
            </Link>

            <Text style={subText}>
              If you continue to have issues, please contact our support team.
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
const alertBox: React.CSSProperties = {
  backgroundColor: '#fef2f2', borderLeft: '4px solid #dc2626',
  borderRadius: '4px', padding: '16px 20px', margin: '24px 0',
};
const alertText: React.CSSProperties = { color: '#991b1b', fontSize: '14px', lineHeight: '1.6', margin: '0' };
const listItem: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: '1.8', margin: '0' };
const button: React.CSSProperties = {
  backgroundColor: '#dc2626', borderRadius: '6px', color: '#ffffff',
  display: 'inline-block', fontSize: '14px', fontWeight: '600',
  padding: '12px 24px', textDecoration: 'none', margin: '20px 0 24px',
};
const subText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '16px 0 0' };
const divider: React.CSSProperties = { borderColor: '#e5e7eb', margin: '0' };
const footer: React.CSSProperties = { padding: '20px 40px', textAlign: 'center' };
const footerText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '4px 0' };
const footerLink: React.CSSProperties = { color: '#9ca3af', textDecoration: 'underline' };
