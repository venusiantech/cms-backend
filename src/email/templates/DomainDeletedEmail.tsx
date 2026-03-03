import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Link,
} from '@react-email/components';

interface DomainDeletedEmailProps {
  email: string;
  domainName: string;
  logoUrl: string;
}

export function DomainDeletedEmail({
  email,
  domainName,
  logoUrl,
}: DomainDeletedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{domainName} has been removed from your Fastofy account</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img src={logoUrl} width="140" height="auto" alt="Fastofy" style={logo} />
            <Text style={brandName}>FASTOFY</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Domain Removed</Heading>
            <Text style={paragraph}>Hi there,</Text>
            <Text style={paragraph}>
              We're confirming that the domain{' '}
              <strong>{domainName}</strong> and all associated website data
              have been permanently deleted from your Fastofy account.
            </Text>

            {/* What was deleted */}
            <Section style={alertBox}>
              <Text style={alertTitle}>What was removed:</Text>
              <Text style={listItem}>• Domain: <strong>{domainName}</strong></Text>
              <Text style={listItem}>• All website pages, sections, and content blocks</Text>
              <Text style={listItem}>• All AI-generated blog posts and images</Text>
              <Text style={listItem}>• All contact form leads for this website</Text>
            </Section>

            <Text style={paragraph}>
              This action is permanent and cannot be undone. If you still want
              a website for this domain, you can re-add it from your dashboard
              and generate a new one.
            </Text>

            <Link href="https://fastofy.com/dashboard" style={button}>
              Go to Dashboard →
            </Link>

            <Text style={subText}>
              If you didn't request this deletion or believe this was a
              mistake, please contact our support team immediately.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Fastofy. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://fastofy.com" style={footerLink}>
                fastofy.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: '32px 0',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  backgroundColor: '#0f172a',
  padding: '24px 32px',
  textAlign: 'center',
};

const logo: React.CSSProperties = {
  display: 'block',
  margin: '0 auto',
};

const brandName: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: '800',
  letterSpacing: '0.12em',
  textAlign: 'center',
  margin: '10px 0 0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const content: React.CSSProperties = {
  padding: '32px 40px',
};

const h1: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 24px',
};

const paragraph: React.CSSProperties = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const alertBox: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #ef4444',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '24px 0',
};

const alertTitle: React.CSSProperties = {
  color: '#991b1b',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0 0 10px',
};

const listItem: React.CSSProperties = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 4px',
};

const button: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  margin: '8px 0 24px',
};

const subText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '16px 0 0',
};

const divider: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '0',
};

const footer: React.CSSProperties = {
  padding: '20px 40px',
  textAlign: 'center',
};

const footerText: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '4px 0',
};

const footerLink: React.CSSProperties = {
  color: '#9ca3af',
  textDecoration: 'underline',
};
