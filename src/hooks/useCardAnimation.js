import { useEffect } from 'react';

/**
 * Hook that applies IntersectionObserver-based fade-in animations to card elements.
 * Adds a CSS class when cards scroll into view.
 *
 * @param {React.MutableRefObject} cardRefs - Ref array of card DOM elements
 * @param {string} visibleClass - CSS class to add when card becomes visible (e.g. 'deal-card-visible')
 * @param {Array} deps - Dependencies that trigger re-observation (e.g. [currentSection, filter])
 * @param {Object} options - Optional config
 * @param {boolean} options.checkInitial - Whether to check if cards are already visible on mount (default: true)
 */
export function useCardAnimation(cardRefs, visibleClass, deps = [], { checkInitial = true } = {}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add(visibleClass);
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      cardRefs.current.forEach((card) => {
        if (card) {
          observer.observe(card);
          if (checkInitial) {
            const rect = card.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
              card.classList.add(visibleClass);
            }
          }
        }
      });

      return () => {
        cardRefs.current.forEach((card) => {
          if (card) observer.unobserve(card);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
