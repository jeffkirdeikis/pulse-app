import React, { memo } from 'react';
import { Edit2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const EditVenueModal = memo(function EditVenueModal({
  editingVenue,
  editVenueForm,
  setEditVenueForm,
  onClose,
  showToast,
  fetchServices,
}) {
  const [saving, setSaving] = React.useState(false);
  if (!editingVenue) return null;
  return (
<div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit venue" onClick={() => { onClose(); }}>
  <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
    <button className="claim-modal-close" onClick={() => { onClose(); }}><X size={24} /></button>

    <div className="claim-modal-header">
      <div className="claim-modal-icon">
        <Edit2 size={32} />
      </div>
      <h2>Edit Business</h2>
      <p>Update information for {editingVenue.name}</p>
    </div>

    <div className="claim-modal-body">
      <div className="claim-form-grid">
        <div className="claim-form-group full">
          <label>Business Name</label>
          <input
            type="text"
            placeholder="Business name"
            value={editVenueForm.name}
            onChange={(e) => setEditVenueForm({...editVenueForm, name: e.target.value})}
          />
        </div>
        <div className="claim-form-group full">
          <label>Address</label>
          <input
            type="text"
            placeholder="Street address"
            value={editVenueForm.address}
            onChange={(e) => setEditVenueForm({...editVenueForm, address: e.target.value})}
          />
        </div>
        <div className="claim-form-group">
          <label>Phone</label>
          <input
            type="tel"
            placeholder="(604) 555-1234"
            value={editVenueForm.phone}
            onChange={(e) => setEditVenueForm({...editVenueForm, phone: e.target.value})}
          />
        </div>
        <div className="claim-form-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="contact@business.com"
            value={editVenueForm.email}
            onChange={(e) => setEditVenueForm({...editVenueForm, email: e.target.value})}
          />
        </div>
        <div className="claim-form-group">
          <label>Website</label>
          <input
            type="url"
            placeholder="https://..."
            value={editVenueForm.website}
            onChange={(e) => setEditVenueForm({...editVenueForm, website: e.target.value})}
          />
        </div>
        <div className="claim-form-group">
          <label>Category</label>
          <input
            type="text"
            placeholder="e.g., Fitness, Restaurant"
            value={editVenueForm.category}
            onChange={(e) => setEditVenueForm({...editVenueForm, category: e.target.value})}
          />
        </div>
      </div>

      <div className="claim-modal-actions">
        <button className="claim-cancel-btn" onClick={() => { onClose(); }}>Cancel</button>
        <button className="claim-submit-btn" disabled={saving || !editVenueForm.name?.trim()} onClick={async () => {
          if (!editingVenue?.id) {
            showToast('Error: No venue ID found', 'error');
            return;
          }
          if (!editVenueForm.name?.trim()) return;
          setSaving(true);
          try {
            const { data, error } = await supabase
              .from('businesses')
              .update({
                name: editVenueForm.name,
                address: editVenueForm.address,
                phone: editVenueForm.phone,
                email: editVenueForm.email,
                website: editVenueForm.website,
                category: editVenueForm.category
              })
              .eq('id', editingVenue.id)
              .select();

            if (error) throw error;

            // Check if any rows were actually updated
            if (!data || data.length === 0) {
              showToast('Update blocked - check database permissions', 'error');
              return;
            }

            showToast('Business updated successfully!', 'success');
            onClose();
            // Refetch services to show updated data
            await fetchServices(true);
          } catch (err) {
            console.error('Error updating business:', err);
            showToast('Failed to update business', 'error');
          } finally {
            setSaving(false);
          }
        }}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  </div>
</div>
  );
});

export default EditVenueModal;
