import React, { memo, useEffect } from 'react';
import { X } from 'lucide-react';

const LegalModal = memo(function LegalModal({ type, onClose }) {
  // Capture ESC key before it reaches the global handler (prevents closing AuthModal underneath)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
    };
    document.addEventListener('keydown', handleEsc, true); // capture phase
    return () => document.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-modal" style={{ maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close"><X size={24} /></button>
        <div style={{ padding: '24px', lineHeight: 1.7 }}>
          {type === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
        </div>
      </div>
    </div>
  );
});

function PrivacyPolicy() {
  return (
    <>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Privacy Policy</h2>
      <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>Last updated: February 2026</p>

      <p>Pulse ("we", "our", "us") operates the Pulse community platform for Squamish, BC. This policy explains how we collect, use, and protect your information.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Information We Collect</h3>
      <p><strong>Account information:</strong> When you create an account, we collect your name, email address, and password. If you sign in with Google, we receive your name, email, and profile photo from Google.</p>
      <p><strong>Usage data:</strong> We collect information about how you use Pulse, including pages viewed, features used, and interactions with businesses and events.</p>
      <p><strong>Content you provide:</strong> Event submissions, reviews, messages to businesses, and profile information you choose to share.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>How We Use Your Information</h3>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li>To provide and improve the Pulse platform</li>
        <li>To show you relevant classes, events, and deals in Squamish</li>
        <li>To enable messaging between you and local businesses</li>
        <li>To send notifications you have opted into (event reminders, new deals)</li>
        <li>To detect and prevent abuse, spam, and security threats</li>
        <li>To generate anonymized, aggregated analytics for businesses</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Data Storage & Security</h3>
      <p>Your data is stored securely on Supabase infrastructure with row-level security policies, encrypted connections, and access controls. We do not sell your personal information to third parties.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Third-Party Services</h3>
      <p>We use the following services that may process your data:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li><strong>Supabase</strong> — Database and authentication</li>
        <li><strong>Google OAuth</strong> — Sign-in (if you choose Google login)</li>
        <li><strong>Sentry</strong> — Error tracking to improve app stability</li>
        <li><strong>Cloudflare</strong> — Security and performance</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Your Rights</h3>
      <p>Under Canadian privacy law (PIPEDA), you have the right to:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li>Access the personal information we hold about you</li>
        <li>Request correction of inaccurate information</li>
        <li>Request deletion of your account and associated data</li>
        <li>Withdraw consent for data processing</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Cookies & Local Storage</h3>
      <p>Pulse uses local storage and service workers to cache data for offline use and improve performance. We do not use third-party advertising cookies.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Data Retention</h3>
      <p>We retain your account data as long as your account is active. If you delete your account, we remove your personal data within 30 days. Anonymized analytics data may be retained indefinitely.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Changes to This Policy</h3>
      <p>We may update this policy from time to time. We will notify you of significant changes through the app.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Contact</h3>
      <p>For privacy questions or data requests, email us at <strong>privacy@pulsesquamish.com</strong>.</p>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Terms of Service</h2>
      <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>Last updated: February 2026</p>

      <p>These terms govern your use of Pulse, a community platform connecting people with classes, events, and deals in Squamish, BC.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>1. Acceptance of Terms</h3>
      <p>By creating an account or using Pulse, you agree to these terms. If you do not agree, do not use the platform.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>2. Account Responsibilities</h3>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li>You must provide accurate information when creating your account</li>
        <li>You are responsible for maintaining the security of your account</li>
        <li>You must be at least 13 years old to use Pulse</li>
        <li>One account per person — do not create multiple accounts</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>3. Acceptable Use</h3>
      <p>You agree not to:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li>Submit false, misleading, or spam content</li>
        <li>Impersonate other people or businesses</li>
        <li>Harass, abuse, or threaten other users or businesses</li>
        <li>Attempt to access other users' accounts or data</li>
        <li>Use automated tools to scrape or abuse the platform</li>
        <li>Violate any applicable laws</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>4. Content & Submissions</h3>
      <p>When you submit events, reviews, or other content:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li>You retain ownership of your content</li>
        <li>You grant Pulse a license to display and distribute your content on the platform</li>
        <li>Submissions are reviewed before publishing — we may reject or remove content at our discretion</li>
        <li>You are responsible for the accuracy of information you submit</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>5. Business Listings</h3>
      <p>Pulse aggregates publicly available information about Squamish businesses. Business owners can claim their listing to manage and update their information. Class schedules, events, and deals are collected from public sources and business submissions.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>6. Bookings & Third Parties</h3>
      <p>Pulse connects you to third-party booking systems (Mindbody, JaneApp, WellnessLiving, etc.). When you click "Book", you are redirected to the business's own booking platform. Pulse is not responsible for transactions, cancellations, or disputes with third-party providers.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>7. Availability & Uptime</h3>
      <p>We aim to keep Pulse available at all times but do not guarantee uninterrupted service. We may perform maintenance, updates, or experience downtime. Class and event information is updated regularly but may not always reflect real-time availability.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>8. Limitation of Liability</h3>
      <p>Pulse is provided "as is". We are not liable for:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
        <li>Inaccurate class schedules, event details, or deal information</li>
        <li>Issues with third-party booking systems</li>
        <li>Losses arising from your use of the platform</li>
        <li>Actions of businesses listed on the platform</li>
      </ul>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>9. Account Termination</h3>
      <p>We may suspend or terminate accounts that violate these terms. You may delete your account at any time through your profile settings.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>10. Changes to Terms</h3>
      <p>We may update these terms. Continued use after changes constitutes acceptance of the new terms.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>11. Governing Law</h3>
      <p>These terms are governed by the laws of British Columbia, Canada.</p>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>Contact</h3>
      <p>Questions about these terms? Email us at <strong>hello@pulsesquamish.com</strong>.</p>
    </>
  );
}

export default LegalModal;
