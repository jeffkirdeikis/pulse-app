import React from 'react';

const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-line title" />
    <div className="skeleton-line medium" />
    <div className="skeleton-line short" />
    <div className="skeleton-tags">
      <div className="skeleton-tag" />
      <div className="skeleton-tag" />
      <div className="skeleton-tag" />
    </div>
  </div>
);

const SkeletonCards = ({ count = 6 }) => (
  <div role="status" aria-label="Loading content">
    <span className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>Loading...</span>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonCards;
