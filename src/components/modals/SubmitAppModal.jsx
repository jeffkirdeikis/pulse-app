import React, { memo, useState, useCallback } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { APP_CATEGORIES } from '../../data/appsData';

const PLATFORM_OPTIONS = [
  { key: 'web', label: 'Web' },
  { key: 'ios', label: 'iOS' },
  { key: 'android', label: 'Android' },
  { key: 'desktop', label: 'Desktop' },
];

const categories = APP_CATEGORIES.filter(c => c !== 'All');

const SubmitAppModal = memo(function SubmitAppModal({ onClose, showToast }) {
  const [form, setForm] = useState({
    name: '',
    tagline: '',
    url: '',
    category: '',
    platforms: { web: false, ios: false, android: false, desktop: false },
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const updateField = useCallback((field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }, []);

  const togglePlatform = useCallback((key) => {
    setForm(f => ({
      ...f,
      platforms: { ...f.platforms, [key]: !f.platforms[key] },
    }));
    setErrors(e => ({ ...e, platforms: undefined }));
  }, []);

  const validate = useCallback(() => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'App name is required';
    if (!form.tagline.trim()) errs.tagline = 'Tagline is required';
    if (!form.url.trim()) errs.url = 'URL is required';
    else if (!/^https?:\/\/.+\..+/.test(form.url.trim())) errs.url = 'Enter a valid URL';
    if (!form.category) errs.category = 'Select a category';
    if (!Object.values(form.platforms).some(Boolean)) errs.platforms = 'Select at least one platform';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email';
    return errs;
  }, [form]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const platformsArray = Object.entries(form.platforms)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const { error } = await supabase.from('app_submissions').insert({
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        url: form.url.trim(),
        category: form.category,
        platforms: platformsArray,
        email: form.email.trim(),
        status: 'pending',
      });

      if (error) throw error;

      showToast?.('App submitted for review!');
      onClose();
    } catch (err) {
      console.error('Submit app error:', err);
      showToast?.('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [form, validate, onClose, showToast]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Submit an app" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content submit-app-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close"><X size={24} /></button>

        <div className="submit-app-header">
          <h2>Submit an App</h2>
          <p>Know a great AI tool? Share it with the community.</p>
        </div>

        <form className="submit-app-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="app-name">App Name *</label>
            <input id="app-name" type="text" placeholder="e.g. ChatGPT" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="app-tagline">Tagline *</label>
            <input id="app-tagline" type="text" placeholder="Short description of what it does" value={form.tagline} onChange={(e) => updateField('tagline', e.target.value)} maxLength={120} />
            {errors.tagline && <span className="field-error">{errors.tagline}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="app-url">URL *</label>
            <input id="app-url" type="url" placeholder="https://example.com" value={form.url} onChange={(e) => updateField('url', e.target.value)} />
            {errors.url && <span className="field-error">{errors.url}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="app-category">Category *</label>
            <select id="app-category" value={form.category} onChange={(e) => updateField('category', e.target.value)}>
              <option value="">Select a category</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            {errors.category && <span className="field-error">{errors.category}</span>}
          </div>

          <div className="form-field">
            <label>Platforms *</label>
            <div className="platform-checkboxes">
              {PLATFORM_OPTIONS.map(p => (
                <label key={p.key} className={`platform-checkbox ${form.platforms[p.key] ? 'checked' : ''}`}>
                  <input type="checkbox" checked={form.platforms[p.key]} onChange={() => togglePlatform(p.key)} />
                  {p.label}
                </label>
              ))}
            </div>
            {errors.platforms && <span className="field-error">{errors.platforms}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="app-email">Your Email *</label>
            <input id="app-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <button type="submit" className="submit-app-btn" disabled={submitting}>
            {submitting ? (
              <><Loader2 size={18} className="spin" /> Submitting...</>
            ) : (
              <><Send size={18} /> Submit App</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
});

export default SubmitAppModal;
