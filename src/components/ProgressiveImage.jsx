import React, { useState, useRef, useEffect } from 'react';

/**
 * Progressive image with blur-up effect.
 * Shows a tiny blurred placeholder, then crossfades to full image on load.
 * Uses IntersectionObserver for lazy loading.
 */
const ProgressiveImage = ({ src, alt, className, style, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`progressive-image-container ${className || ''}`}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {/* Blurred placeholder */}
      {src && (
        <div
          className="progressive-image-placeholder"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: loaded ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        />
      )}

      {/* Full image (only loads when in viewport) */}
      {inView && src && (
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
          {...props}
        />
      )}
    </div>
  );
};

export default ProgressiveImage;
