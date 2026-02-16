import React, { memo } from 'react';
import { Edit2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const EditEventModal = memo(function EditEventModal({
  editingEvent,
  editEventForm,
  setEditEventForm,
  onClose,
  showToast,
  setEventsRefreshKey,
}) {
  const [saving, setSaving] = React.useState(false);
  if (!editingEvent) return null;
  return (
<div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit event" onClick={() => { onClose(); }}>
  <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
    <div className="modal-header-premium">
      <h2>Edit {editingEvent.eventType === 'class' ? 'Class' : 'Event'}</h2>
      <button className="modal-close-btn" onClick={() => { onClose(); }}><X size={20} /></button>
    </div>
    <div className="modal-body-premium">
      <div className="form-group">
        <label>Title</label>
        <input type="text" value={editEventForm.title} onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))} maxLength={200} />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea rows={3} value={editEventForm.description} onChange={(e) => setEditEventForm(prev => ({ ...prev, description: e.target.value }))} maxLength={5000} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={editEventForm.date} onChange={(e) => setEditEventForm(prev => ({ ...prev, date: e.target.value }))} min={new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).toISOString().split('T')[0]} />
        </div>
        <div className="form-group">
          <label>Start Time</label>
          <input type="time" value={editEventForm.startTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, startTime: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>End Time</label>
          <input type="time" value={editEventForm.endTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, endTime: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label>Price</label>
          <input type="text" placeholder="Free or $20" value={editEventForm.price} onChange={(e) => setEditEventForm(prev => ({ ...prev, price: e.target.value }))} maxLength={50} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <input type="text" value={editEventForm.category} onChange={(e) => setEditEventForm(prev => ({ ...prev, category: e.target.value }))} maxLength={50} />
        </div>
      </div>
    </div>
    <div className="modal-actions-premium">
      <button className="btn-secondary" onClick={() => { onClose(); }}>Cancel</button>
      <button className="btn-primary-gradient" disabled={saving || !editEventForm.title?.trim()} onClick={async () => {
        if (saving || !editEventForm.title?.trim()) return;
        setSaving(true);
        try {
          const updateData = {
            title: editEventForm.title,
            description: editEventForm.description,
            start_date: editEventForm.date,
            end_date: editEventForm.date,
            start_time: editEventForm.startTime,
            end_time: editEventForm.endTime,
            category: editEventForm.category
          };
          const priceStr = (editEventForm.price || '').trim();
          if (priceStr && priceStr.toLowerCase() !== 'free') {
            const cleaned = priceStr.replace(/[^0-9.]/g, '');
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed) && parsed >= 0) {
              updateData.price = String(parsed);
              updateData.is_free = false;
            } else {
              updateData.is_free = true;
              updateData.price = null;
            }
          } else {
            updateData.is_free = true;
            updateData.price = null;
          }
          const { error } = await supabase.from('events').update(updateData).eq('id', editingEvent.id);
          if (error) throw error;
          showToast(`"${editEventForm.title}" updated!`, 'success');
          onClose();
          setEventsRefreshKey(k => k + 1);
        } catch (err) {
          console.error('Error updating event:', err);
          showToast('Failed to update', 'error');
        } finally {
          setSaving(false);
        }
      }}>{saving ? 'Saving...' : 'Save Changes'}</button>
    </div>
  </div>
</div>
  );
});

export default EditEventModal;
