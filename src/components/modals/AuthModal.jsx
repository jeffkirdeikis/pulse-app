import React, { memo, useState, useRef } from 'react';
import { AlertCircle, Mail, MapPin, X } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { supabase } from '../../lib/supabase';
import LegalModal from './LegalModal';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const AuthModal = memo(function AuthModal({ onClose, onSuccess }) {
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [legalModal, setLegalModal] = useState(null);
  const turnstileRef = useRef(null);

  const handleClose = () => {
    setAuthError('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setFieldErrors({});
    onClose();
  };

  const validateForm = () => {
    const errors = {};
    const emailTrimmed = authEmail.trim();
    if (!emailTrimmed) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = 'Please enter a valid email';
    }
    if (!authPassword) {
      errors.password = 'Password is required';
    } else if (authPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (authMode === 'signup' && !authName.trim()) {
      errors.name = 'Name is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!validateForm()) return;
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
        options: TURNSTILE_SITE_KEY ? { captchaToken } : undefined
      });

      if (error) {
        setAuthError(error.message);
      } else {
        handleClose();
      }
    } catch {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
      setCaptchaToken('');
      turnstileRef.current?.reset();
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!validateForm()) return;
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            full_name: authName,
            name: authName
          },
          ...(TURNSTILE_SITE_KEY ? { captchaToken } : {})
        }
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthError('');
        if (data?.session) {
          onSuccess('Account created! Welcome to Pulse!');
        } else {
          onSuccess('Check your email to confirm your account!');
        }
        handleClose();
      }
    } catch {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
      setCaptchaToken('');
      turnstileRef.current?.reset();
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Sign in" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={handleClose}><X size={24} /></button>
        <div className="auth-modal-header">
          <div className="auth-logo">
            <MapPin size={32} />
          </div>
          <h2>{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{authMode === 'signin' ? 'Sign in to save events and connect with Squamish' : 'Join the Squamish community today'}</p>
        </div>
        <div className="auth-modal-body">
          <button className="auth-btn google" onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } } });
            if (error) console.error('Auth error:', error);
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <form onSubmit={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp} className="auth-form" noValidate>
            {authMode === 'signup' && (
              <div className="auth-form-group">
                <label>Full Name</label>
                <input type="text" placeholder="Your name" value={authName} onChange={(e) => { setAuthName(e.target.value); if (fieldErrors.name) setFieldErrors(fe => ({...fe, name: ''})); }} aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <span className="auth-field-error" role="alert" style={{color:'#dc2626',fontSize:'12px',marginTop:'4px',display:'block'}}>{fieldErrors.name}</span>}
              </div>
            )}
            <div className="auth-form-group">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={authEmail} onChange={(e) => { setAuthEmail(e.target.value); if (fieldErrors.email) setFieldErrors(fe => ({...fe, email: ''})); }} aria-invalid={!!fieldErrors.email} />
              {fieldErrors.email && <span className="auth-field-error" role="alert" style={{color:'#dc2626',fontSize:'12px',marginTop:'4px',display:'block'}}>{fieldErrors.email}</span>}
            </div>
            <div className="auth-form-group">
              <label>Password</label>
              <input type="password" placeholder={authMode === 'signup' ? 'Create a password (min 6 chars)' : 'Your password'} value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); if (fieldErrors.password) setFieldErrors(fe => ({...fe, password: ''})); }} aria-invalid={!!fieldErrors.password} />
              {fieldErrors.password && <span className="auth-field-error" role="alert" style={{color:'#dc2626',fontSize:'12px',marginTop:'4px',display:'block'}}>{fieldErrors.password}</span>}
            </div>
            {TURNSTILE_SITE_KEY && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  options={{ size: 'compact', theme: 'light' }}
                />
              </div>
            )}
            {authError && (
              <div className="auth-error">
                <AlertCircle size={16} />
                <span>{authError}</span>
              </div>
            )}
            <button type="submit" className="auth-btn email" disabled={authLoading || (TURNSTILE_SITE_KEY && !captchaToken)}>
              <Mail size={20} />
              {authLoading ? 'Please wait...' : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <div className="auth-switch">
            {authMode === 'signin' ? (
              <p>Don't have an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); setFieldErrors({}); }}>Sign Up</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => { setAuthMode('signin'); setAuthError(''); setFieldErrors({}); }}>Sign In</button></p>
            )}
          </div>
        </div>
        <div className="auth-modal-footer">
          <p>By continuing, you agree to our{' '}
            <button onClick={() => setLegalModal('terms')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>Terms of Service</button>
            {' '}and{' '}
            <button onClick={() => setLegalModal('privacy')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>Privacy Policy</button>
          </p>
        </div>
      </div>
      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}
    </div>
  );
});

export default AuthModal;
