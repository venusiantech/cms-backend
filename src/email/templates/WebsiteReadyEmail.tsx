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

interface WebsiteReadyEmailProps {
  email: string;
  domainName: string;
  subdomain: string;
  logoUrl: string;
}

export function WebsiteReadyEmail({
  email,
  domainName,
  subdomain,
  logoUrl,
}: WebsiteReadyEmailProps) {
  const siteUrl = `https://${subdomain}`;

  return (
    <Html>
      <Head />
      <Preview>Your website for {domainName} is live on Fastofy!</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img src={logoUrl} width="140" height="auto" alt="Fastofy" style={logo} />
            <Text style={brandName}>FASTOFY</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Your website is ready! 🎉</Heading>
            <Text style={paragraph}>Hi there,</Text>
            <Text style={paragraph}>
              Great news — your AI-powered website for{' '}
              <strong>{domainName}</strong> has been generated and is ready to
              go.
            </Text>

            {/* Site details card */}
            <Section style={card}>
              <Text style={cardLabel}>Domain</Text>
              <Text style={cardValue}>{domainName}</Text>
              <Hr style={cardDivider} />
              <Text style={cardLabel}>Preview URL</Text>
              <Text style={cardValue}>{subdomain}.fastofy.com</Text>
            </Section>

            <Text style={paragraph}>
              Your site already includes 3 AI-written blog posts with images.
              You can edit content, generate more blogs, or toggle the contact
              form from your dashboard.
            </Text>

            <Link href="https://fastofy.com/dashboard" style={button}>
              Open Dashboard →
            </Link>

            <Text style={subText}>
              To make <strong>{domainName}</strong> point to your new site, add
              a CNAME record pointing to your subdomain in your DNS settings.
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

const card: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  padding: '16px 20px',
  margin: '24px 0',
};

const cardLabel: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  margin: '0 0 4px',
};

const cardValue: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 12px',
  fontFamily: 'monospace',
};

const cardDivider: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '12px 0',
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
  backgroundColor: '#fffbeb',
  borderLeft: '3px solid #f59e0b',
  padding: '10px 14px',
  borderRadius: '4px',
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
