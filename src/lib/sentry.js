import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking
 *
 * To enable Sentry:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new React project
 * 3. Add VITE_SENTRY_DSN to your .env.local file
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    if (import.meta.env.DEV) console.log('[Sentry] No DSN configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' or 'production'

    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Session replay for debugging (optional)
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Filter out non-critical errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors (user offline, etc.)
      if (error?.message?.includes('Failed to fetch')) {
        return null;
      }

      // Ignore ResizeObserver errors (browser quirk)
      if (error?.message?.includes('ResizeObserver')) {
        return null;
      }

      return event;
    },

    // Add extra context
    initialScope: {
      tags: {
        app: 'pulse',
        version: '1.0.0'
      }
    }
  });

  if (import.meta.env.DEV) console.log('[Sentry] Error tracking initialized');
}

/**
 * Capture an error manually
 */
export function captureError(error, context = {}) {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('[Error]', error, context);
  }
}

/**
 * Set user context for error reports
 */
export function setUser(user) {
  if (import.meta.env.VITE_SENTRY_DSN && user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name
    });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

export { Sentry };
