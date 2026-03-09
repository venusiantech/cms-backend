import * as React from 'react';
import {
  Body, Container, Head, Heading, Html, Img, Preview,
  Section, Text, Hr, Link,
} from '@react-email/components';

interface Props {
  email: string;
  planName: string;
  amountPaid: number;
  creditsAdded: number;
  nextRenewalDate: string;
  logoUrl: string;
}

export function SubscriptionRenewalEmail({ email, planName, amountPaid, creditsAdded, nextRenewalDate, logoUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`Your ${planName} subscription has renewed — ${creditsAdded} credits added`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img src={logoUrl} width="140" height="auto" alt="Fastofy" style={logo} />
            <Text style={brandName}>FASTOFY</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Subscription Renewed ✅</Heading>
            <Text style={paragraph}>Hi there,</Text>
            <Text style={paragraph}>
              Your <strong>{planName}</strong> subscription has been automatically renewed.
              Fresh credits have been added to your account for this month.
            </Text>

            <Section style={summaryBox}>
              <Text style={summaryRow}>
                <span style={summaryLabel}>Plan</span>
                <span style={summaryValue}>{planName}</span>
              </Text>
              <Text style={summaryRow}>
                <span style={summaryLabel}>Amount charged</span>
                <span style={summaryValue}>${amountPaid.toFixed(2)}</span>
              </Text>
              <Text style={summaryRow}>
                <span style={summaryLabel}>Credits added</span>
                <span style={{ ...summaryValue, color: '#16a34a', fontWeight: '700' }}>+{creditsAdded} credits</span>
              </Text>
              <Text style={{ ...summaryRow, margin: '0' }}>
                <span style={summaryLabel}>Next renewal</span>
                <span style={summaryValue}>{nextRenewalDate}</span>
              </Text>
            </Section>

            <Text style={paragraph}>
              Credits roll over — any unused credits from last month are still in your account.
            </Text>

            <Link href="https://fastofy.com/dashboard" style={button}>
              View Dashboard →
            </Link>
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
const summaryBox: React.CSSProperties = {
  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: '8px', padding: '16px 20px', margin: '24px 0',
};
const summaryRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: '14px', margin: '0 0 10px', color: '#374151',
};
const summaryLabel: React.CSSProperties = { color: '#6b7280' };
const summaryValue: React.CSSProperties = { fontWeight: '600', color: '#0f172a' };
const button: React.CSSProperties = {
  backgroundColor: '#0f172a', borderRadius: '6px', color: '#ffffff',
  display: 'inline-block', fontSize: '14px', fontWeight: '600',
  padding: '12px 24px', textDecoration: 'none', margin: '8px 0 24px',
};
const divider: React.CSSProperties = { borderColor: '#e5e7eb', margin: '0' };
const footer: React.CSSProperties = { padding: '20px 40px', textAlign: 'center' };
const footerText: React.CSSProperties = { color: '#9ca3af', fontSize: '12px', margin: '4px 0' };
const footerLink: React.CSSProperties = { color: '#9ca3af', textDecoration: 'underline' };
