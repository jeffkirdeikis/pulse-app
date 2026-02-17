import React, { memo, useRef } from 'react';
import { AlertCircle, Building, CheckCircle, FileText, Mail, RefreshCw, Upload, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

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
  claimVerificationMethod,
  setClaimVerificationMethod,
  claimDocuments,
  setClaimDocuments,
  handleVerifyClaimCode,
  handleResendClaimCode,
  setClaimVerificationStep,
  claimResendCooldown,
  session,
  services,
  onClose,
  setShowAuthModal,
  handleClaimBusiness,
}) {
  const fileInputRef = useRef(null);
  const focusTrapRef = useFocusTrap();

  const maskedEmail = claimFormData.email
    ? claimFormData.email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => first + '*'.repeat(Math.min(middle.length, 5)) + domain)
    : '';

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) return false;
      if (f.size > MAX_FILE_SIZE) return false;
      return true;
    });
    setClaimDocuments(prev => [...prev, ...valid].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocument = (index) => {
    setClaimDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Claim business" onClick={onClose}>
      <div className="claim-modal-premium" ref={focusTrapRef} onClick={(e) => e.stopPropagation()}>
        <button className="claim-modal-close" onClick={onClose} aria-label="Close"><X size={24} /></button>

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
                  disabled={claimResendCooldown > 0}
                  style={{ background: 'none', border: 'none', color: claimResendCooldown > 0 ? '#9ca3af' : '#4f46e5', cursor: claimResendCooldown > 0 ? 'default' : 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} />
                  {claimResendCooldown > 0 ? `Resend in ${claimResendCooldown}s` : 'Resend Code'}
                </button>
                <button
                  onClick={() => { setClaimVerificationCode(''); setClaimVerificationStep('form'); }}
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
                    {services.filter(s => s.name?.toLowerCase().includes(claimSearchQuery.toLowerCase())).slice(0, 8).map(biz => (
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
                    {services.filter(s => s.name?.toLowerCase().includes(claimSearchQuery.toLowerCase())).length === 0 && (
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

              {/* Verification Method Selector */}
              <div style={{ margin: '16px 0', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px', color: '#374151', fontSize: '14px' }}>How would you like to verify ownership?</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setClaimVerificationMethod('email')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer',
                      border: claimVerificationMethod === 'email' ? '2px solid #4f46e5' : '1px solid #d1d5db',
                      background: claimVerificationMethod === 'email' ? '#eef2ff' : '#fff',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <Mail size={20} style={{ color: claimVerificationMethod === 'email' ? '#4f46e5' : '#6b7280' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: claimVerificationMethod === 'email' ? '#4f46e5' : '#374151' }}>Email Code</span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Instant verification</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimVerificationMethod('document')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer',
                      border: claimVerificationMethod === 'document' ? '2px solid #4f46e5' : '1px solid #d1d5db',
                      background: claimVerificationMethod === 'document' ? '#eef2ff' : '#fff',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <FileText size={20} style={{ color: claimVerificationMethod === 'document' ? '#4f46e5' : '#6b7280' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: claimVerificationMethod === 'document' ? '#4f46e5' : '#374151' }}>Upload Documents</span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Business license, etc.</span>
                  </button>
                </div>
              </div>

              {/* Document Upload Area */}
              {claimVerificationMethod === 'document' && (
                <div style={{ margin: '0 0 16px 0' }}>
                  <div
                    onClick={() => claimDocuments.length < MAX_FILES && fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #d1d5db', borderRadius: '10px', padding: '24px',
                      textAlign: 'center', cursor: claimDocuments.length < MAX_FILES ? 'pointer' : 'default',
                      background: '#fafafa', transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => { if (claimDocuments.length < MAX_FILES) e.currentTarget.style.borderColor = '#4f46e5'; }}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  >
                    <Upload size={28} style={{ color: '#6b7280', marginBottom: '8px' }} />
                    <p style={{ fontWeight: 600, color: '#374151', marginBottom: '4px', fontSize: '14px' }}>
                      {claimDocuments.length < MAX_FILES ? 'Click to upload documents' : 'Maximum files reached'}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                      PDF, JPG, PNG — max 5MB each — up to {MAX_FILES} files
                    </p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                      Business license, utility bill, or other proof of ownership
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />

                  {/* Uploaded Files List */}
                  {claimDocuments.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {claimDocuments.map((file, i) => (
                        <div key={`${file.name}-${file.size}`} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
                        }}>
                          <FileText size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{formatFileSize(file.size)}</div>
                          </div>
                          <button
                            onClick={() => removeDocument(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                <button className="claim-submit-btn" onClick={handleClaimBusiness} disabled={claimSubmitting || !claimFormData.businessName?.trim() || !claimFormData.ownerName?.trim() || !claimFormData.email?.trim()}>
                  {claimSubmitting ? 'Submitting...' : claimVerificationMethod === 'document' ? 'Submit with Documents' : 'Submit Claim'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default ClaimBusinessModal;
