import React, { memo } from 'react';
import { Send, X } from 'lucide-react';

const ContactSheet = memo(function ContactSheet({
  contactBusiness,
  contactSubject,
  setContactSubject,
  contactMessage,
  setContactMessage,
  sendingMessage,
  onClose,
  submitContactForm,
}) {
  if (!contactBusiness) return null;
  return (
    <div className="modal-overlay contact-sheet-overlay" role="dialog" aria-modal="true" aria-label="Contact business" onClick={() => onClose()}>
      <div className="contact-bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button type="button" className="close-btn sheet-close" onClick={() => onClose()} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="sheet-header">
          <h2>Contact Business</h2>
          <p className="sheet-subtitle">{contactBusiness.name}</p>
        </div>

        <div className="contact-form">
          <div className="form-field">
            <label>Subject (optional)</label>
            <input
              type="text"
              placeholder="e.g., Class inquiry, Booking question"
              value={contactSubject}
              onChange={(e) => setContactSubject(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="form-field">
            <label>Message</label>
            <textarea
              placeholder="Write your message here..."
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              rows={4}
            />
          </div>
          <button
            type="button"
            className="send-message-btn"
            onClick={submitContactForm}
            disabled={!contactMessage.trim() || sendingMessage}
          >
            {sendingMessage ? (
              <>
                <div className="spinner-small" />
                Sending...
              </>
            ) : (
              <>
                <Send size={18} />
                Send Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ContactSheet;
