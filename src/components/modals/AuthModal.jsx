import React, { memo, useState } from 'react';
import { AlertCircle, Mail, MapPin, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AuthModal = memo(function AuthModal({ onClose, onSuccess }) {
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleClose = () => {
    setAuthError('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    onClose();
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
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
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            full_name: authName,
            name: authName
          }
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
            const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
            if (error) console.error('Auth error:', error);
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <form onSubmit={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp} className="auth-form">
            {authMode === 'signup' && (
              <div className="auth-form-group">
                <label>Full Name</label>
                <input type="text" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} required />
              </div>
            )}
            <div className="auth-form-group">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
            </div>
            <div className="auth-form-group">
              <label>Password</label>
              <input type="password" placeholder={authMode === 'signup' ? 'Create a password (min 6 chars)' : 'Your password'} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} minLength={6} required />
            </div>
            {authError && (
              <div className="auth-error">
                <AlertCircle size={16} />
                <span>{authError}</span>
              </div>
            )}
            <button type="submit" className="auth-btn email" disabled={authLoading}>
              <Mail size={20} />
              {authLoading ? 'Please wait...' : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <div className="auth-switch">
            {authMode === 'signin' ? (
              <p>Don't have an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }}>Sign Up</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => { setAuthMode('signin'); setAuthError(''); }}>Sign In</button></p>
            )}
          </div>
        </div>
        <div className="auth-modal-footer">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
});

export default AuthModal;
