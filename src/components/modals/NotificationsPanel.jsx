import React, { memo } from 'react';
import { Bell, Calendar, DollarSign, MessageCircle, Star, Check, Trash2, X } from 'lucide-react';

const ICON_MAP = {
  event_reminder: Calendar,
  new_deal: DollarSign,
  message: MessageCircle,
  save_confirm: Star,
  system: Bell,
};

const COLOR_MAP = {
  event_reminder: '#3b82f6',
  new_deal: '#10b981',
  message: '#8b5cf6',
  save_confirm: '#f59e0b',
  system: '#6b7280',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const NotificationsPanel = memo(function NotificationsPanel({
  notifications,
  loading,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNotificationClick,
}) {
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ESC key is handled by the global keyboard handler in App.jsx — no local handler needed

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Notifications" onClick={onClose}>
      <div className="notifications-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notif-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Notifications</h2>
            {unreadCount > 0 && (
              <span className="notif-badge-count">{unreadCount}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button type="button" className="notif-action-btn" onClick={onMarkAllRead} title="Mark all read">
                <Check size={16} />
              </button>
            )}
            {notifications.length > 0 && (
              <button type="button" className="notif-action-btn" onClick={onClearAll} title="Clear all">
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" className="notif-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="notif-list">
          {loading ? (
            <div className="notif-empty">
              <div className="spinner" />
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">
              <Bell size={40} style={{ opacity: 0.3 }} />
              <h3 style={{ margin: '12px 0 4px', fontSize: '16px', fontWeight: 600, color: '#374151' }}>All caught up!</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>No notifications yet. We'll let you know about events, deals, and messages.</p>
            </div>
          ) : (
            notifications.map(notif => {
              const Icon = ICON_MAP[notif.type] || Bell;
              const color = COLOR_MAP[notif.type] || '#6b7280';
              return (
                <div
                  key={notif.id}
                  className={`notif-item ${notif.is_read ? '' : 'unread'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!notif.is_read) onMarkRead(notif.id);
                    if (onNotificationClick) onNotificationClick(notif);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!notif.is_read) onMarkRead(notif.id); if (onNotificationClick) onNotificationClick(notif); } }}
                >
                  <div className="notif-icon" style={{ background: `${color}15`, color }}>
                    <Icon size={18} />
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">{notif.title}</div>
                    <div className="notif-body">{notif.body}</div>
                    <div className="notif-time">{timeAgo(notif.created_at)}</div>
                  </div>
                  {!notif.is_read && <div className="notif-dot" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

export default NotificationsPanel;
