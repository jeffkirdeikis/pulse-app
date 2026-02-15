import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus within a modal element. Auto-focuses first focusable
 * element on mount and restores focus on unmount.
 *
 * @returns {React.RefObject} Attach to the modal container element
 */
export function useFocusTrap() {
  const ref = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const el = ref.current;
    if (!el) return;

    // Focus first focusable element (or the container itself)
    const first = el.querySelector(FOCUSABLE);
    if (first) {
      first.focus();
    } else {
      el.setAttribute('tabindex', '-1');
      el.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = [...el.querySelectorAll(FOCUSABLE)];
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
        previouslyFocused.current.focus();
      }
    };
  }, []);

  return ref;
}
