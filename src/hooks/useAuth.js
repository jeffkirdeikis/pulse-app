import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook for authentication state and handlers
 * Consolidates all auth-related state from App.jsx
 */
export function useAuth() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const resetAuthForm = () => {
    setAuthError('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    resetAuthForm();
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthError('');
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      });

      if (error) throw error;
      closeAuthModal();
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: { full_name: authName }
        }
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setAuthError('Check your email for a confirmation link');
      } else {
        closeAuthModal();
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } }
    });
    if (error) console.error('Auth error:', error);
  };

  return {
    // State
    showAuthModal,
    authMode,
    authEmail,
    authPassword,
    authName,
    authError,
    authLoading,

    // Setters
    setShowAuthModal,
    setAuthMode,
    setAuthEmail,
    setAuthPassword,
    setAuthName,
    setAuthError,

    // Handlers
    closeAuthModal,
    switchAuthMode,
    handleEmailSignIn,
    handleEmailSignUp,
    handleGoogleSignIn,
    resetAuthForm
  };
}
