import React, { memo, useState, useEffect } from 'react';
import {
  Building, Check, CheckCircle, Eye, MessageSquare, Percent, SlidersHorizontal,
  Sparkles, X, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminPanelModal = memo(function AdminPanelModal({
  adminTab,
  setAdminTab,
  pendingSubmissions,
  onClose,
  setView,
  approveSubmission,
  rejectSubmission,
}) {
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    if (adminTab === 'feedback') {
      setFeedbackLoading(true);
      supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => { setFeedbackItems(data || []); setFeedbackLoading(false); })
        .catch(() => setFeedbackLoading(false));
    }
  }, [adminTab]);
  return (
    <div className="modal-overlay admin-modal-overlay" role="dialog" aria-modal="true" aria-label="Admin panel" onClick={() => onClose()}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn admin-close" onClick={() => onClose()}><X size={24} /></button>

        <div className="admin-header">
          <div className="admin-header-content">
            <div className="admin-icon-wrapper">
              <Eye size={28} />
            </div>
            <div>
              <h1>Admin Panel</h1>
              <p>Review and approve submissions</p>
            </div>
          </div>
          <button className="admin-btn approve" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { onClose(); setView('admin'); }}>
            <SlidersHorizontal size={16} />
            Open Full Dashboard
          </button>
        </div>

        <div className="admin-content">
          <div className="admin-tabs">
            <button className={`admin-tab ${adminTab === 'pending' ? 'active' : ''}`} onClick={() => setAdminTab('pending')}>
              Pending
              {pendingSubmissions.filter(s => s.status === 'pending').length > 0 && (
                <span className="tab-badge">{pendingSubmissions.filter(s => s.status === 'pending').length}</span>
              )}
            </button>
            <button className={`admin-tab ${adminTab === 'approved' ? 'active' : ''}`} onClick={() => setAdminTab('approved')}>
              Approved
              {pendingSubmissions.filter(s => s.status === 'approved').length > 0 && (
                <span className="tab-badge">{pendingSubmissions.filter(s => s.status === 'approved').length}</span>
              )}
            </button>
            <button className={`admin-tab ${adminTab === 'rejected' ? 'active' : ''}`} onClick={() => setAdminTab('rejected')}>
              Rejected
              {pendingSubmissions.filter(s => s.status === 'rejected').length > 0 && (
                <span className="tab-badge">{pendingSubmissions.filter(s => s.status === 'rejected').length}</span>
              )}
            </button>
            <button className={`admin-tab ${adminTab === 'feedback' ? 'active' : ''}`} onClick={() => setAdminTab('feedback')}>
              <MessageSquare size={14} />
              Feedback
            </button>
          </div>

          <div className="admin-submissions">
            {adminTab === 'feedback' ? (
              feedbackLoading ? (
                <div className="admin-empty"><p>Loading feedback...</p></div>
              ) : feedbackItems.length === 0 ? (
                <div className="admin-empty">
                  <MessageSquare size={48} />
                  <h3>No feedback yet</h3>
                  <p>User feedback submissions will appear here</p>
                </div>
              ) : (
                feedbackItems.map(fb => (
                  <div key={fb.id} className="admin-submission-card">
                    <div className="submission-card-header">
                      <div className={`submission-type-badge ${fb.type}`}>
                        {fb.type === 'bug' && '🐛'}
                        {fb.type === 'comment' && '💬'}
                        {fb.type === 'suggestion' && '💡'}
                        {' '}{fb.type}
                      </div>
                      <span className="submission-time">
                        {new Date(fb.created_at).toLocaleDateString()} {new Date(fb.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="submission-desc" style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{fb.message}</p>
                    {fb.email && (
                      <div className="submission-meta"><span>Email: {fb.email}</span></div>
                    )}
                    <div className="submission-meta" style={{ fontSize: '11px', color: '#9ca3af' }}>
                      <span>{fb.page_url}</span>
                      {fb.viewport && <span>{fb.viewport}</span>}
                    </div>
                    {fb.screenshot_url && (
                      <a href={fb.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#3b82f6' }}>View screenshot</a>
                    )}
                  </div>
                ))
              )
            ) : pendingSubmissions.filter(s => s.status === adminTab).length === 0 ? (
              <div className="admin-empty">
                <CheckCircle size={48} />
                <h3>{adminTab === 'pending' ? 'All caught up!' : `No ${adminTab} submissions`}</h3>
                <p>{adminTab === 'pending' ? 'No pending submissions to review' : `There are no ${adminTab} submissions yet`}</p>
              </div>
            ) : (
              pendingSubmissions.filter(s => s.status === adminTab).map(submission => (
                <div key={submission.id} className="admin-submission-card">
                  <div className="submission-card-header">
                    <div className={`submission-type-badge ${submission.type}`}>
                      {submission.type === 'event' && <Zap size={14} />}
                      {submission.type === 'class' && <Sparkles size={14} />}
                      {submission.type === 'deal' && <Percent size={14} />}
                      {submission.type}
                    </div>
                    <span className="submission-time">
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4>{submission.data.title}</h4>
                  <p className="submission-business">
                    <Building size={14} />
                    {submission.business.name}
                    {submission.business.verified && <Check size={12} className="verified-mini" />}
                  </p>
                  <p className="submission-desc">{submission.data.description}</p>
                  <div className="submission-meta">
                    <span>By: {submission.submittedBy.name}</span>
                    <span>{submission.submittedBy.email}</span>
                  </div>
                  <div className="admin-actions">
                    <button 
                      className="admin-btn approve"
                      onClick={() => approveSubmission(submission.id)}
                    >
                      <Check size={16} />
                      Approve
                    </button>
                    <button 
                      className="admin-btn reject"
                      onClick={() => {
                        const reason = prompt('Rejection reason:', 'Does not meet guidelines');
                        if (reason) rejectSubmission(submission.id, reason);
                      }}
                    >
                      <X size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdminPanelModal;
