import React from 'react';
import { Calendar, Star, Plus, Eye, Users, SlidersHorizontal, Building } from 'lucide-react';

/**
 * Profile dropdown menu with navigation items for profile, calendar,
 * saved items, submissions, business claiming, admin panel, and settings.
 */
const ProfileMenu = React.memo(function ProfileMenu({
  user,
  myCalendar,
  pendingSubmissions,
  onClose,
  onProfileOpen,
  onCalendarOpen,
  onSavedOpen,
  onSubmissionOpen,
  onClaimBusinessOpen,
  onAdminPanelOpen,
  onSettingsOpen,
  onSignOut,
}) {
  return (
    <div className="profile-menu-overlay" onClick={onClose}>
      <div className="profile-menu-dropdown" onClick={(e) => e.stopPropagation()}>
        <div className="profile-menu-header">
          <div className="profile-avatar large">{user.avatar ? <img src={user.avatar} alt={user.name ? `${user.name}'s avatar` : 'Profile photo'} loading="lazy" width="48" height="48" /> : (user.name?.trim() ? user.name.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U' : 'U')}</div>
          <div className="profile-menu-info">
            <h3>{user.name || 'Guest'}</h3>
            <p>{user.email || 'Not signed in'}</p>
          </div>
        </div>
        <div className="profile-menu-divider"></div>
        <div className="profile-menu-items">
          <button className="profile-menu-item" onClick={onProfileOpen}>
            <Users size={18} />
            <span>My Profile</span>
          </button>
          <button className="profile-menu-item" onClick={onCalendarOpen}>
            <Calendar size={18} />
            <span>My Calendar</span>
            {myCalendar.length > 0 && <span className="menu-badge">{myCalendar.length}</span>}
          </button>
          <button className="profile-menu-item" onClick={onSavedOpen}>
            <Star size={18} />
            <span>Saved Items</span>
          </button>
          <div className="profile-menu-divider"></div>
          <button className="profile-menu-item" onClick={onSubmissionOpen}>
            <Plus size={18} />
            <span>Add Event / Class / Deal</span>
          </button>
          <button className="profile-menu-item" onClick={onClaimBusinessOpen}>
            <Building size={18} />
            <span>Claim Business</span>
          </button>
          {user.isAdmin && (
            <>
              <div className="profile-menu-divider"></div>
              <button className="profile-menu-item admin" onClick={onAdminPanelOpen}>
                <Eye size={18} />
                <span>Admin Panel</span>
                {pendingSubmissions.filter(s => s.status === 'pending').length > 0 && (
                  <span className="menu-badge admin">{pendingSubmissions.filter(s => s.status === 'pending').length}</span>
                )}
              </button>
            </>
          )}
          <div className="profile-menu-divider"></div>
          <button className="profile-menu-item" onClick={onSettingsOpen}>
            <SlidersHorizontal size={18} />
            <span>Settings</span>
          </button>
        </div>
        <div className="profile-menu-divider"></div>
        <button className="profile-menu-item logout" onClick={onSignOut}>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
});

export default ProfileMenu;
