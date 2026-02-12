import React, { useState, useRef, useCallback } from 'react';

/**
 * Pull-to-refresh with native rubber-band physics and Pulse heartbeat indicator.
 * Wrap around scrollable content.
 */
const THRESHOLD = 80;
const MAX_PULL = 140;

const PulseSpinner = ({ progress, refreshing }) => (
  <div
    className="ptr-indicator"
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '48px',
      opacity: refreshing ? 1 : Math.min(progress / THRESHOLD, 1),
      transition: refreshing ? 'opacity 0.2s' : 'none',
    }}
  >
    <svg
      viewBox="0 0 100 120"
      width="32"
      height="32"
      style={{
        animation: refreshing ? 'ptrPulse 1s ease-in-out infinite' : 'none',
        transform: refreshing ? 'none' : `scale(${0.5 + 0.5 * Math.min(progress / THRESHOLD, 1)})`,
        transition: refreshing ? 'transform 0.3s' : 'none',
      }}
    >
      <path
        d="M50 8C33 8 19 22 19 39C19 52 28 63 50 95C72 63 81 52 81 39C81 22 67 8 50 8Z"
        stroke="#3b82f6"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="39" r="22" stroke="#3b82f6" strokeWidth="7" fill="none" />
      <path
        d="M33 39 L38 39 L42 33 L46 45 L50 28 L54 45 L58 33 L62 39 L67 39"
        stroke="#3b82f6"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: refreshing ? 'none' : '120',
          strokeDashoffset: refreshing ? 0 : 120 - (120 * Math.min(progress / THRESHOLD, 1)),
          transition: refreshing ? 'stroke-dashoffset 0.3s' : 'none',
        }}
      />
    </svg>
  </div>
);

const PullToRefresh = ({ onRefresh, children }) => {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    // Only activate when scrolled to top
    if (containerRef.current && containerRef.current.scrollTop > 0) return;
    if (refreshing) return;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    setPulling(true);
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff < 0) {
      setPullDistance(0);
      return;
    }
    // Rubber-band: diminishing returns as you pull further
    const rubberBand = diff * (1 - Math.min(diff / (MAX_PULL * 3), 0.6));
    const clamped = Math.min(rubberBand, MAX_PULL);
    setPullDistance(clamped);
    if (clamped > 10) {
      e.preventDefault();
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } catch { /* silent */ }
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', touchAction: pullDistance > 10 ? 'none' : 'auto' }}
    >
      <div
        className="ptr-wrapper"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pulling ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: `-${THRESHOLD * 0.6 + 8}px`,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <PulseSpinner progress={pullDistance} refreshing={refreshing} />
        </div>
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
