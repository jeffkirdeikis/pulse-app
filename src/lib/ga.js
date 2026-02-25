/**
 * Google Analytics 4 event tracking utility.
 * Wraps window.gtag so components don't need to check for its existence.
 */
export function trackGA(eventName, params = {}) {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
}
