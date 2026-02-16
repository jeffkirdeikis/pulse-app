import React, { memo } from 'react';
import {
  Building, Check, Info, Percent, Plus, Sparkles, Users, X, Zap
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const SubmissionModal = memo(function SubmissionModal({
  submissionStep,
  submissionType,
  submissionForm,
  setSubmissionForm,
  showImageCropper,
  cropperImage,
  cropPosition,
  setCropPosition,
  cropZoom,
  setCropZoom,
  cropperType,
  userClaimedBusinesses,
  user,
  onClose,
  setSubmissionStep,
  setSubmissionType,
  setShowImageCropper,
  setCropperImage,
  setCropperType,
  selectSubmissionType,
  selectBusinessType,
  removeImage,
  handleImageSelect,
  handleCropComplete,
  submitForApproval,
  submitting,
  getSelectedBusinessInfo,
  showToast,
}) {
  const focusTrapRef = useFocusTrap();
  return (
    <div className="modal-overlay submission-modal-overlay" role="dialog" aria-modal="true" aria-label="Submit event" onClick={onClose}>
      <div className="submission-modal" ref={focusTrapRef} onClick={(e) => e.stopPropagation()}>
        <button className="close-btn submission-close" onClick={onClose}><X size={24} /></button>

        {/* Step 1: Select Type */}
        {submissionStep === 1 && (
          <>
            <div className="submission-header">
              <div className="submission-header-content">
                <div className="submission-icon-wrapper">
                  <Plus size={28} />
                </div>
                <div>
                  <h1>Add to Pulse</h1>
                  <p>Share something with the Squamish community</p>
                </div>
              </div>
            </div>
            <div className="submission-content">
              <h3 className="step-title">What would you like to add?</h3>
              <div className="type-selection-grid">
                <button className="type-card event" onClick={() => selectSubmissionType('event')}>
                  <div className="type-card-icon">
                    <Zap size={32} />
                  </div>
                  <h4>Event</h4>
                  <p>One-time or recurring community events</p>
                </button>
                <button className="type-card class" onClick={() => selectSubmissionType('class')}>
                  <div className="type-card-icon">
                    <Sparkles size={32} />
                  </div>
                  <h4>Class</h4>
                  <p>Fitness, art, music, or educational classes</p>
                </button>
                <button className="type-card deal" onClick={() => selectSubmissionType('deal')}>
                  <div className="type-card-icon">
                    <Percent size={32} />
                  </div>
                  <h4>Deal</h4>
                  <p>Special offers and promotions</p>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Form with Business Selector and Images */}
        {submissionStep === 2 && (
          <>
            <div className={`submission-header ${submissionType}`}>
              <div className="submission-header-content">
                <div className={`submission-icon-wrapper ${submissionType}`}>
                  {submissionType === 'event' && <Zap size={28} />}
                  {submissionType === 'class' && <Sparkles size={28} />}
                  {submissionType === 'deal' && <Percent size={28} />}
                </div>
                <div>
                  <h1>Add {submissionType === 'event' ? 'Event' : submissionType === 'class' ? 'Class' : 'Deal'}</h1>
                  <p>Fill in the details</p>
                </div>
              </div>
            </div>
            <div className="submission-content scrollable">
              <div className="submission-form">

                {/* Business Selector Section */}
                <div className="form-group full">
                  <label>Who is hosting this? *</label>
                  <div className="business-selector">
                    {/* My Claimed Businesses */}
                    {userClaimedBusinesses.length > 0 ? (
                      <div className="business-selector-section">
                        <span className="selector-label">My Businesses</span>
                        {userClaimedBusinesses.map(biz => (
                          <button 
                            key={biz.id}
                            className={`business-option ${submissionForm.businessType === 'claimed' && submissionForm.selectedBusinessId === biz.id ? 'selected' : ''}`}
                            onClick={() => selectBusinessType('claimed', biz.id)}
                          >
                            <div className="business-option-avatar">
                              <Building size={18} />
                            </div>
                            <div className="business-option-info">
                              <span className="business-option-name">{biz.name}</span>
                              <span className="business-option-address">{biz.address}</span>
                            </div>
                            {biz.verified && (
                              <span className="business-option-verified">
                                <Check size={12} />
                              </span>
                            )}
                            {submissionForm.businessType === 'claimed' && submissionForm.selectedBusinessId === biz.id && (
                              <div className="option-check"><Check size={16} /></div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="business-selector-section">
                        <div className="no-businesses-notice">
                          <Building size={20} />
                          <div>
                            <span>No claimed businesses yet</span>
                            <p>Claim your business from your profile to post as a verified business</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Options */}
                    <div className="business-selector-section">
                      <span className="selector-label">{userClaimedBusinesses.length > 0 ? 'Other Options' : 'Select an Option'}</span>
                      <button 
                        className={`business-option ${submissionForm.businessType === 'new' ? 'selected' : ''}`}
                        onClick={() => selectBusinessType('new')}
                      >
                        <div className="business-option-avatar new">
                          <Plus size={18} />
                        </div>
                        <div className="business-option-info">
                          <span className="business-option-name">New Business / Organization</span>
                          <span className="business-option-address">Add a business not yet on Pulse</span>
                        </div>
                        {submissionForm.businessType === 'new' && (
                          <div className="option-check"><Check size={16} /></div>
                        )}
                      </button>
                      <button 
                        className={`business-option ${submissionForm.businessType === 'individual' ? 'selected' : ''}`}
                        onClick={() => selectBusinessType('individual')}
                      >
                        <div className="business-option-avatar individual">
                          <Users size={18} />
                        </div>
                        <div className="business-option-info">
                          <span className="business-option-name">Community Member</span>
                          <span className="business-option-address">Hosting as an individual, not a business</span>
                        </div>
                        {submissionForm.businessType === 'individual' && (
                          <div className="option-check"><Check size={16} /></div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* New Business Name (only if "new" selected) */}
                {submissionForm.businessType === 'new' && (
                  <>
                    <div className="form-group full">
                      <label>Business / Organization Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Breathe Fitness Studio"
                        value={submissionForm.businessName}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, businessName: e.target.value }))}
                        className="form-input"
                        maxLength={200}
                      />
                    </div>
                    <div className="form-group full">
                      <label>Business Address</label>
                      <input
                        type="text"
                        placeholder="e.g., 1234 Main St, Squamish"
                        value={submissionForm.businessAddress}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, businessAddress: e.target.value }))}
                        className="form-input"
                        maxLength={300}
                      />
                    </div>
                  </>
                )}

                {/* Image Upload Section */}
                <div className="form-group full">
                  <label>Images</label>
                  <div className="image-upload-grid">
                    {/* Square Image (1:1) */}
                    <div className="image-upload-card square">
                      <div className="image-upload-label">
                        <span>Square Image</span>
                        <span className="image-ratio">1:1</span>
                      </div>
                      {submissionForm.squareImagePreview ? (
                        <div className="image-preview square">
                          <img src={submissionForm.squareImagePreview} alt="Square preview" />
                          <button className="remove-image-btn" onClick={() => removeImage('square')}>
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="image-upload-area square">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleImageSelect(e, 'square')}
                            style={{ display: 'none' }}
                          />
                          <div className="upload-placeholder">
                            <Plus size={24} />
                            <span>Add Photo</span>
                          </div>
                        </label>
                      )}
                    </div>

                    {/* Banner Image (3:1) */}
                    <div className="image-upload-card banner">
                      <div className="image-upload-label">
                        <span>Banner Image</span>
                        <span className="image-ratio">3:1</span>
                      </div>
                      {submissionForm.bannerImagePreview ? (
                        <div className="image-preview banner">
                          <img src={submissionForm.bannerImagePreview} alt="Banner preview" />
                          <button className="remove-image-btn" onClick={() => removeImage('banner')}>
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="image-upload-area banner">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleImageSelect(e, 'banner')}
                            style={{ display: 'none' }}
                          />
                          <div className="upload-placeholder">
                            <Plus size={24} />
                            <span>Add Banner</span>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="form-group full">
                  <label>{submissionType === 'deal' ? 'Deal Title' : submissionType === 'class' ? 'Class Name' : 'Event Title'} *</label>
                  <input
                    type="text"
                    placeholder={submissionType === 'deal' ? 'e.g., Happy Hour 50% Off Apps' : submissionType === 'class' ? 'e.g., Hot Yoga Flow' : 'e.g., Live Music Night'}
                    value={submissionForm.title}
                    onChange={(e) => setSubmissionForm(prev => ({ ...prev, title: e.target.value }))}
                    className="form-input"
                    maxLength={200}
                  />
                </div>

                <div className="form-group full">
                  <label>Description *</label>
                  <textarea
                    placeholder="Tell people what to expect..."
                    value={submissionForm.description}
                    onChange={(e) => setSubmissionForm(prev => ({ ...prev, description: e.target.value }))}
                    className="form-input textarea"
                    rows={3}
                    maxLength={5000}
                  />
                </div>

                {/* Event/Class specific fields */}
                {(submissionType === 'event' || submissionType === 'class') && (
                  <>
                    <div className="form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={submissionForm.date}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, date: e.target.value }))}
                        className="form-input"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group half">
                      <label>Start Time *</label>
                      <input 
                        type="time" 
                        value={submissionForm.startTime}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, startTime: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group half">
                      <label>End Time *</label>
                      <input 
                        type="time" 
                        value={submissionForm.endTime}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, endTime: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Recurrence</label>
                      <select 
                        value={submissionForm.recurrence}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, recurrence: e.target.value }))}
                        className="form-input"
                      >
                        <option value="none">One-time event</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Price</label>
                      <input
                        type="text"
                        placeholder="e.g., $25 or Free"
                        value={submissionForm.price}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, price: e.target.value }))}
                        className="form-input"
                        maxLength={50}
                      />
                    </div>
                    <div className="form-group">
                      <label>Age Group</label>
                      <select 
                        value={submissionForm.ageGroup}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, ageGroup: e.target.value }))}
                        className="form-input"
                      >
                        <option value="">All Ages</option>
                        <option value="Kids (0-12)">Kids (0-12)</option>
                        <option value="Teens (13-17)">Teens (13-17)</option>
                        <option value="Adults (18+)">Adults (18+)</option>
                        <option value="Seniors (65+)">Seniors (65+)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Category *</label>
                      <select 
                        value={submissionForm.category}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, category: e.target.value }))}
                        className="form-input"
                      >
                        <option value="">Select category...</option>
                        <option value="Music">Music</option>
                        <option value="Fitness">Fitness</option>
                        <option value="Arts">Arts</option>
                        <option value="Community">Community</option>
                        <option value="Wellness">Wellness</option>
                        <option value="Outdoors & Nature">Outdoors & Nature</option>
                        <option value="Food & Drink">Food & Drink</option>
                        <option value="Family">Family</option>
                        <option value="Nightlife">Nightlife</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Deal specific fields */}
                {submissionType === 'deal' && (
                  <>
                    <div className="form-group full">
                      <label>Discount Type *</label>
                      <select
                        value={submissionForm.discountType}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, discountType: e.target.value }))}
                        className="form-input"
                      >
                        <option value="percent">Percentage Off</option>
                        <option value="fixed">Dollar Amount Off</option>
                        <option value="bogo">Buy One Get One</option>
                        <option value="free_item">Free Item</option>
                        <option value="special">Special Offer</option>
                      </select>
                    </div>
                    {(submissionForm.discountType === 'percent' || submissionForm.discountType === 'fixed') && (
                      <div className="form-group full">
                        <label>{submissionForm.discountType === 'percent' ? 'Discount Percentage' : 'Discount Amount ($)'}</label>
                        <input
                          type="number"
                          placeholder={submissionForm.discountType === 'percent' ? 'e.g., 25' : 'e.g., 10'}
                          value={submissionForm.discountValue}
                          onChange={(e) => setSubmissionForm(prev => ({ ...prev, discountValue: e.target.value }))}
                          className="form-input"
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Original Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 40.00"
                        value={submissionForm.originalPrice}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, originalPrice: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Deal Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 30.00"
                        value={submissionForm.dealPrice}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, dealPrice: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group full">
                      <label>Valid Until</label>
                      <input
                        type="date"
                        value={submissionForm.validUntil}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, validUntil: e.target.value }))}
                        className="form-input"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group full">
                      <label>Schedule / Availability *</label>
                      <input
                        type="text"
                        placeholder="e.g., Mon-Fri 3-6pm, Weekends Only"
                        value={submissionForm.schedule}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, schedule: e.target.value }))}
                        className="form-input"
                        maxLength={200}
                      />
                    </div>
                    <div className="form-group full">
                      <label>Terms & Conditions</label>
                      <textarea
                        placeholder="e.g., Cannot be combined with other offers..."
                        value={submissionForm.terms}
                        onChange={(e) => setSubmissionForm(prev => ({ ...prev, terms: e.target.value }))}
                        className="form-input textarea"
                        rows={2}
                        maxLength={2000}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="submission-notice">
                <Info size={18} />
                <p>All submissions are reviewed by our team before going live. You'll receive a notification once approved.</p>
              </div>

              <div className="submission-actions">
                <button className="btn-back" onClick={() => setSubmissionStep(1)}>
                  Back
                </button>
                <button
                  className="btn-submit"
                  onClick={submitForApproval}
                  disabled={
                    submitting ||
                    !submissionForm.title?.trim() || !submissionForm.description?.trim() || !submissionForm.businessType ||
                    (submissionForm.businessType === 'new' && !submissionForm.businessName?.trim()) ||
                    (submissionForm.businessType === 'claimed' && !submissionForm.selectedBusinessId) ||
                    ((submissionType === 'event' || submissionType === 'class') && (!submissionForm.date || !submissionForm.startTime || !submissionForm.endTime || !submissionForm.category)) ||
                    (submissionType === 'deal' && !submissionForm.schedule)
                  }
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {submissionStep === 3 && (
          <>
            <div className="submission-success">
              <div className="success-animation">
                <div className="success-circle">
                  <Check size={48} />
                </div>
              </div>
              <h2>Submitted for Review!</h2>
              <p>Our team will review your {submissionType} and notify you once it's approved. This usually takes 24-48 hours.</p>
              <div className="success-details">
                <div className="detail-row">
                  <span className="label">Type:</span>
                  <span className="value">{submissionType === 'event' ? 'Event' : submissionType === 'class' ? 'Class' : 'Deal'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Title:</span>
                  <span className="value">{submissionForm.title}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Host:</span>
                  <span className="value">{submissionForm.businessName}</span>
                </div>
              </div>
              <button className="btn-done" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}

        {/* Image cropper removed — global ImageCropper in App.jsx handles all cropping */}
      </div>
    </div>
  );
});

export default SubmissionModal;
