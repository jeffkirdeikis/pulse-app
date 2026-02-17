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
<div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit venue" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
    <button type="button" className="claim-modal-close" onClick={() => { onClose(); }} aria-label="Close"><X size={24} /></button>

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
          <label htmlFor="edit-venue-name">Business Name</label>
          <input
            id="edit-venue-name"
            type="text"
            placeholder="Business name"
            value={editVenueForm.name}
            onChange={(e) => setEditVenueForm({...editVenueForm, name: e.target.value})}
            maxLength={200}
            autoComplete="organization"
          />
        </div>
        <div className="claim-form-group full">
          <label htmlFor="edit-venue-address">Address</label>
          <input
            id="edit-venue-address"
            type="text"
            placeholder="Street address"
            value={editVenueForm.address}
            onChange={(e) => setEditVenueForm({...editVenueForm, address: e.target.value})}
            maxLength={300}
            autoComplete="street-address"
          />
        </div>
        <div className="claim-form-group">
          <label htmlFor="edit-venue-phone">Phone</label>
          <input
            id="edit-venue-phone"
            type="tel"
            placeholder="(604) 555-1234"
            value={editVenueForm.phone}
            onChange={(e) => setEditVenueForm({...editVenueForm, phone: e.target.value})}
            maxLength={20}
            autoComplete="tel"
          />
        </div>
        <div className="claim-form-group">
          <label htmlFor="edit-venue-email">Email</label>
          <input
            id="edit-venue-email"
            type="email"
            placeholder="contact@business.com"
            value={editVenueForm.email}
            onChange={(e) => setEditVenueForm({...editVenueForm, email: e.target.value})}
            maxLength={254}
            autoComplete="email"
          />
        </div>
        <div className="claim-form-group">
          <label htmlFor="edit-venue-website">Website</label>
          <input
            id="edit-venue-website"
            type="url"
            placeholder="https://..."
            value={editVenueForm.website}
            onChange={(e) => setEditVenueForm({...editVenueForm, website: e.target.value})}
            maxLength={500}
            autoComplete="url"
          />
        </div>
        <div className="claim-form-group">
          <label htmlFor="edit-venue-category">Category</label>
          <input
            id="edit-venue-category"
            type="text"
            placeholder="e.g., Fitness, Restaurant"
            value={editVenueForm.category}
            onChange={(e) => setEditVenueForm({...editVenueForm, category: e.target.value})}
            maxLength={100}
          />
        </div>
      </div>

      <div className="claim-modal-actions">
        <button type="button" className="claim-cancel-btn" onClick={() => { onClose(); }}>Cancel</button>
        <button type="button" className="claim-submit-btn" disabled={saving || !editVenueForm.name?.trim()} onClick={async () => {
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
