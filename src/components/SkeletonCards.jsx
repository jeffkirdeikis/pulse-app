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
  <div>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonCards;
