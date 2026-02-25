import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

const PLATFORM_LABELS = [
  { key: 'web', emoji: '\uD83C\uDF10', label: 'Web' },
  { key: 'ios', emoji: '\uD83C\uDF4F', label: 'iOS' },
  { key: 'android', emoji: '\uD83E\uDD16', label: 'Android' },
  { key: 'desktop', emoji: '\uD83D\uDDA5\uFE0F', label: 'Desktop' },
];

const CATEGORY_COLORS = {
  'Chat & Assistants': '#3b82f6',
  'Writing & Productivity': '#10b981',
  'Image & Design': '#f59e0b',
  'Code & Dev': '#8b5cf6',
  'Video & Audio': '#ef4444',
  'Research & Data': '#06b6d4',
  'Business': '#6366f1',
};

const AppCard = React.memo(function AppCard({ app, index }) {
  const activePlatforms = PLATFORM_LABELS.filter(p => app.platforms[p.key]);
  const categoryColor = CATEGORY_COLORS[app.category] || '#6b7280';

  return (
    <motion.div
      className="app-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: index < 10 ? index * 0.04 : 0 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="app-card-header">
        <div className="app-card-icon">
          {app.name.charAt(0)}
        </div>
        <div className="app-card-title-area">
          <div className="app-card-name-row">
            <h3 className="app-card-name">{app.name}</h3>
            {app.featured && <span className="app-featured-badge">Featured</span>}
          </div>
          <span className="app-category-badge" style={{ color: categoryColor, backgroundColor: categoryColor + '15', borderColor: categoryColor + '30' }}>
            {app.category}
          </span>
        </div>
      </div>

      <p className="app-card-tagline">{app.tagline}</p>

      <div className="app-card-footer">
        <div className="app-platform-pills">
          {activePlatforms.map(p => (
            <span key={p.key} className="app-platform-pill">
              {p.emoji} {p.label}
            </span>
          ))}
        </div>
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="app-open-link"
          onClick={(e) => e.stopPropagation()}
        >
          Open <ExternalLink size={14} />
        </a>
      </div>
    </motion.div>
  );
});

export default AppCard;
