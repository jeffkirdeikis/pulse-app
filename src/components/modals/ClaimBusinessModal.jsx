import React, { memo } from 'react';
import { AlertCircle, Building, CheckCircle, Mail, RefreshCw, X } from 'lucide-react';

const ClaimBusinessModal = memo(function ClaimBusinessModal({
  claimSearchQuery,
  setClaimSearchQuery,
  claimSelectedBusiness,
  setClaimSelectedBusiness,
  claimFormData,
  setClaimFormData,
  claimSubmitting,
  claimVerificationStep,
  claimVerificationCode,
  setClaimVerificationCode,
  claimVerifying,
  handleVerifyClaimCode,
  handleResendClaimCode,
  session,
  services,
  onClose,
  setShowAuthModal,
  handleClaimBusiness,
}) {
  const maskedEmail = claimFormData.email
    ? claimFormData.email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => first + '*'.repeat(Math.min(middle.length, 5)) + domain)
    : '';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Claim business" onClick={onClose}>
      <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
        <button className="claim-modal-close" onClick={onClose}><X size={24} /></button>

        {/* Purple Gradient Header */}
        <div className="claim-modal-header">
          <div className="claim-modal-icon">
            {claimVerificationStep === 'verify' ? <Mail size={32} /> : <Building size={32} />}
          </div>
          <h2>{claimVerificationStep === 'verify' ? 'Check Your Email' : 'Claim Your Business'}</h2>
          <p>{claimVerificationStep === 'verify'
            ? `We sent a 6-digit code to ${maskedEmail}`
            : 'Get access to analytics, manage your listings, and connect with customers'
          }</p>
        </div>

        {/* Form Body */}
        <div className="claim-modal-body">
          {!session?.user ? (
            <div className="claim-signin-prompt">
              <div className="signin-message">
                <AlertCircle size={24} />
                <p>Please sign in to claim your business</p>
              </div>
              <button className="claim-signin-btn" onClick={() => { onClose(); setShowAuthModal(true); }}>
                Sign In to Continue
              </button>
            </div>
          ) : claimVerificationStep === 'verify' ? (
            /* Verification Code Entry */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '8px 0' }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={claimVerificationCode}
                onChange={(e) => setClaimVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  width: '200px', textAlign: 'center', fontSize: '28px', fontWeight: 700,
                  letterSpacing: '8px', padding: '14px 16px', border: '2px solid #d1d5db',
                  borderRadius: '12px', fontFamily: 'monospace', color: '#111827',
                }}
                autoFocus
              />
              <button
                className="claim-submit-btn"
                onClick={handleVerifyClaimCode}
                disabled={claimVerifying || claimVerificationCode.length !== 6}
                style={{ width: '100%' }}
              >
                {claimVerifying ? 'Verifying...' : 'Verify Email'}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleResendClaimCode}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} />
                  Resend Code
                </button>
                <button
                  onClick={() => { setClaimVerificationCode(''); }}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px' }}
                >
                  Wrong email? Go back
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Business Search */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Find your business</label>
                <input
                  type="text"
                  placeholder="Search Squamish businesses..."
                  value={claimSelectedBusiness ? claimSelectedBusiness.name : claimSearchQuery}
                  onChange={(e) => { setClaimSearchQuery(e.target.value); setClaimSelectedBusiness(null); }}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                />
                {claimSearchQuery.length >= 2 && !claimSelectedBusiness && (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '4px', background: '#fff' }}>
                    {services.filter(s => s.name.toLowerCase().includes(claimSearchQuery.toLowerCase())).slice(0, 8).map(biz => (
                      <div key={biz.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={() => {
                          setClaimSelectedBusiness(biz);
                          setClaimFormData(prev => ({ ...prev, businessName: biz.name, address: biz.address || '' }));
                          setClaimSearchQuery('');
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{biz.name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{biz.category} {biz.address ? '· ' + biz.address : ''}</div>
                        </div>
                        <CheckCircle size={16} style={{ color: '#9ca3af' }} />
                      </div>
                    ))}
                    {services.filter(s => s.name.toLowerCase().includes(claimSearchQuery.toLowerCase())).length === 0 && (
                      <div style={{ padding: '12px 14px', color: '#6b7280', textAlign: 'center' }}>No businesses found</div>
                    )}
                  </div>
                )}
                {claimSelectedBusiness && (
                  <div style={{ marginTop: '8px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={16} style={{ color: '#16a34a' }} />
                    <span style={{ fontWeight: 600, color: '#166534' }}>{claimSelectedBusiness.name}</span>
                    <button onClick={() => { setClaimSelectedBusiness(null); setClaimSearchQuery(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                )}
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>Select from the directory above, or fill in the form below for unlisted businesses</p>
              </div>

              <div className="claim-form-grid">
                <div className="claim-form-group full">
                  <label>Business Name *</label>
                  <input type="text" placeholder="e.g., The Sound Martial Arts" value={claimFormData.businessName} onChange={(e) => setClaimFormData({...claimFormData, businessName: e.target.value})} />
                </div>
                <div className="claim-form-group">
                  <label>Your Name *</label>
                  <input type="text" placeholder="Full name" value={claimFormData.ownerName} onChange={(e) => setClaimFormData({...claimFormData, ownerName: e.target.value})} />
                </div>
                <div className="claim-form-group">
                  <label>Email *</label>
                  <input type="email" placeholder="your@email.com" value={claimFormData.email} onChange={(e) => setClaimFormData({...claimFormData, email: e.target.value})} />
                </div>
                <div className="claim-form-group">
                  <label>Phone</label>
                  <input type="tel" placeholder="(604) 555-1234" value={claimFormData.phone} onChange={(e) => setClaimFormData({...claimFormData, phone: e.target.value})} />
                </div>
                <div className="claim-form-group">
                  <label>Role</label>
                  <select value={claimFormData.role} onChange={(e) => setClaimFormData({...claimFormData, role: e.target.value})}>
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="representative">Authorized Representative</option>
                  </select>
                </div>
                <div className="claim-form-group full">
                  <label>Business Address</label>
                  <input type="text" placeholder="Street address in Squamish" value={claimFormData.address} onChange={(e) => setClaimFormData({...claimFormData, address: e.target.value})} />
                </div>
              </div>

              <div className="claim-benefits">
                <div className="claim-benefit">
                  <CheckCircle size={18} />
                  <span>Manage your business profile</span>
                </div>
                <div className="claim-benefit">
                  <CheckCircle size={18} />
                  <span>View analytics & insights</span>
                </div>
                <div className="claim-benefit">
                  <CheckCircle size={18} />
                  <span>Respond to reviews</span>
                </div>
                <div className="claim-benefit">
                  <CheckCircle size={18} />
                  <span>Create deals & promotions</span>
                </div>
              </div>

              <div className="claim-modal-actions">
                <button className="claim-cancel-btn" onClick={onClose}>Cancel</button>
                <button className="claim-submit-btn" onClick={handleClaimBusiness} disabled={claimSubmitting}>{claimSubmitting ? 'Submitting...' : 'Submit Claim'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default ClaimBusinessModal;
