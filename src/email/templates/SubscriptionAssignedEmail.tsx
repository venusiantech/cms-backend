import * as React from 'react';
import {
  Body, Container, Head, Heading, Html, Img, Preview,
  Section, Text, Hr, Link,
} from '@react-email/components';

interface Props {
  email: string;
  planName: string;
  logoUrl: string;
}

export function SubscriptionAssignedEmail({ email, planName, logoUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>You've been assigned the {planName} plan on Fastofy</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img src={logoUrl} width="140" height="auto" alt="Fastofy" style={logo} />
            <Text style={brandName}>FASTOFY</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Your Subscription is Active!</Heading>
            <Text style={paragraph}>Hi there,</Text>
            <Text style={paragraph}>
              The Fastofy team has assigned you the{' '}
              <strong>{planName}</strong> subscription. Your plan is now active
              and your credits have been updated.
            </Text>

            <Section style={highlightBox}>
              <Text style={highlightText}>What's included in {planName}:</Text>
              <Text style={listItem}>✦ Credits added to your account</Text>
              <Text style={listItem}>✦ Generate AI-powered websites</Text>
              <Text style={listItem}>✦ Create and publish blog content</Text>
            </Section>

            <Text style={paragraph}>
              Head to your dashboard to start using your new plan.
            </Text>

            <Link href="https://fastofy.com/dashboard" style={button}>
              Go to Dashboard →
            </Link>

            <Text style={subText}>
              If you have any questions, reply to this email or contact support.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Fastofy. All rights reserved.
            </Text>
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
const header: React.CSSProperties = {
  backgroundColor: '#0f172a', padding: '24px 32px', textAlign: 'center',
};
const logo: React.CSSProperties = { display: 'block', margin: '0 auto' };
const brandName: React.CSSProperties = {
  color: '#ffffff', fontSize: '22px', fontWeight: '800',
  letterSpacing: '0.12em', textAlign: 'center', margin: '10px 0 0',
};
const content: React.CSSProperties = { padding: '32px 40px' };
const h1: React.CSSProperties = { color: '#0f172a', fontSize: '24px', fontWeight: '700', margin: '0 0 24px' };
const paragraph: React.CSSProperties = { color: '#374151', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' };
const highlightBox: React.CSSProperties = {
  backgroundColor: '#f0fdf4', borderLeft: '4px solid #16a34a',
  borderRadius: '4px', padding: '16px 20px', margin: '24px 0',
};
const highlightText: React.CSSProperties = { color: '#15803d', fontSize: '14px', fontWeight: '600', margin: '0 0 12px' };
const listItem: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: '1.6', margin: '0 0 6px' };
const button: React.CSSProperties = {
  backgroundColor: '#0f172a', borderRadius: '6px', color: '#ffffff',
  display: 'inline-block', fontSize: '14px', fontWeight: '600',
  padding: '12px 24px', textDecoration: 'none', margin: '8px 0 24px',
};
const subText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '16px 0 0' };
const divider: React.CSSProperties = { borderColor: '#e5e7eb', margin: '0' };
const footer: React.CSSProperties = { padding: '20px 40px', textAlign: 'center' };
const footerText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '4px 0' };
const footerLink: React.CSSProperties = { color: '#9ca3af', textDecoration: 'underline' };
