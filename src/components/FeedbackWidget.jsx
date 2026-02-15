import { useState, useEffect, useRef, memo } from 'react';
import { MessageSquare, X, ImagePlus, Info, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TYPES = [
  { id: 'bug', label: 'Bug Report', icon: '🐛', placeholder: 'Describe what happened and what you expected...' },
  { id: 'comment', label: 'Comment', icon: '💬', placeholder: 'Share your thoughts about Pulse...' },
  { id: 'suggestion', label: 'Suggestion', icon: '💡', placeholder: 'What would you like to see on Pulse?' },
];

const FeedbackWidget = memo(function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fabPulse, setFabPulse] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setFabPulse(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const currentType = TYPES.find(t => t.id === selectedType);

  const handleClose = () => {
    setIsOpen(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      let screenshot_url = null;

      // Upload screenshot if present
      if (screenshotFile) {
        const ext = screenshotFile.name.split('.').pop();
        const filename = `${crypto.randomUUID()}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('feedback-screenshots')
          .upload(filename, screenshotFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('feedback-screenshots')
            .getPublicUrl(filename);
          screenshot_url = urlData.publicUrl;
        } else {
          console.error('Screenshot upload error:', uploadError);
        }
      }

      // Get user session if available
      const { data: { session } } = await supabase.auth.getSession();

      const { error: insertError } = await supabase.from('feedback').insert({
        type: selectedType,
        message: message.trim(),
        email: email.trim() || null,
        screenshot_url,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        user_id: session?.user?.id || null,
      });

      if (insertError) throw insertError;

      // Send email notification (fire-and-forget)
      supabase.functions.invoke('notify-feedback', {
        body: { type: selectedType, message: message.trim(), email: email.trim() || null, screenshot_url, page_url: window.location.href, user_agent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}`, user_id: session?.user?.id || null, created_at: new Date().toISOString() },
      }).catch(() => {}); // Don't block on email failure

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setIsOpen(false);
        setMessage('');
        setEmail('');
        setScreenshot(null);
        setScreenshotFile(null);
        setSelectedType('bug');
      }, 2200);
    } catch (err) {
      setError('Failed to send feedback. Please try again.');
      console.error('Feedback error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setError('Only image files (PNG, JPG, GIF, WebP) are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot must be under 5MB');
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot({ name: file.name, preview: ev.target.result });
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="feedback-backdrop"
          onClick={handleClose}
        />
      )}

      {/* FAB */}
      {!isOpen && (
        <button
          className={`feedback-fab${fabPulse ? ' feedback-fab-pulse' : ''}`}
          onClick={() => setIsOpen(true)}
          aria-label="Send feedback"
        >
          <MessageSquare size={20} />
          <span>Feedback</span>
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="feedback-modal">
          {submitted ? (
            <div className="feedback-success">
              <div className="feedback-success-icon">✓</div>
              <div className="feedback-success-title">Thanks for your feedback!</div>
              <div className="feedback-success-subtitle">We'll review it shortly.</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="feedback-header">
                <div>
                  <div className="feedback-header-title">Send us feedback</div>
                  <div className="feedback-header-subtitle">Help us make Pulse better for Squamish</div>
                </div>
                <button className="feedback-close" onClick={handleClose} aria-label="Close feedback">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="feedback-body">
                {/* Type Selector */}
                <div className="feedback-types">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      className={`feedback-type-btn${selectedType === t.id ? ' active' : ''}`}
                      onClick={() => setSelectedType(t.id)}
                    >
                      <span className="feedback-type-icon">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  className="feedback-textarea"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={currentType?.placeholder}
                  maxLength={5000}
                  aria-label="Feedback message"
                />

                {/* Screenshot (bug only) */}
                {selectedType === 'bug' && (
                  <div className="feedback-screenshot-section">
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    {screenshot ? (
                      <div className="feedback-screenshot-preview">
                        <img src={screenshot.preview} alt="preview" />
                        <span className="feedback-screenshot-name">{screenshot.name}</span>
                        <button onClick={() => { setScreenshot(null); setScreenshotFile(null); }} className="feedback-screenshot-remove" aria-label="Remove screenshot">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button className="feedback-screenshot-btn" onClick={() => fileRef.current?.click()}>
                        <ImagePlus size={16} />
                        Attach screenshot
                      </button>
                    )}
                  </div>
                )}

                {/* Email */}
                <input
                  type="email"
                  className="feedback-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email (optional — so we can follow up)"
                  aria-label="Email address (optional)"
                />

                {/* Context badge */}
                <div className="feedback-context-badge">
                  <Info size={14} />
                  Page URL & browser info will be included automatically
                </div>

                {/* Error */}
                {error && <div className="feedback-error">{error}</div>}

                {/* Submit */}
                <button
                  className="feedback-submit"
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                >
                  {submitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send size={16} />
                      Send Feedback
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
});

export default FeedbackWidget;
