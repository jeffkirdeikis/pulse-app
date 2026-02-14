import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const INITIAL_SUBMISSION_FORM = {
  businessType: '',
  selectedBusinessId: '',
  businessName: '',
  businessAddress: '',
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  price: '',
  ageGroup: '',
  category: '',
  recurrence: 'none',
  schedule: '',
  terms: '',
  discountType: 'percent',
  discountValue: '',
  originalPrice: '',
  dealPrice: '',
  validUntil: '',
  squareImage: null,
  bannerImage: null,
  squareImagePreview: '',
  bannerImagePreview: ''
};

/**
 * Hook for the submission system and shared image cropper.
 *
 * @param {Object} user - Current user
 * @param {Object} options
 * @param {Function} options.showToast - Toast display callback
 * @param {Array} options.userClaimedBusinesses - User's claimed businesses
 * @param {Function} options.updateAvatar - Profile avatar upload (for image cropper)
 * @param {Function} options.updateCoverPhoto - Profile cover photo upload (for image cropper)
 */
export function useSubmissions(user, { showToast, userClaimedBusinesses, updateAvatar, updateCoverPhoto } = {}) {
  // Submission state
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionStep, setSubmissionStep] = useState(1);
  const [submissionType, setSubmissionType] = useState(null);
  const [submissionForm, setSubmissionForm] = useState(INITIAL_SUBMISSION_FORM);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);

  // Image cropper state (shared between submissions and profile)
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperType, setCropperType] = useState(null);
  const [cropperImage, setCropperImage] = useState(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);

  // Open submission modal
  const openSubmissionModal = useCallback(() => {
    setSubmissionStep(1);
    setSubmissionType(null);
    setSubmissionForm(INITIAL_SUBMISSION_FORM);
    setShowImageCropper(false);
    setCropperImage(null);
    setShowSubmissionModal(true);
  }, []);

  // Close submission modal
  const closeSubmissionModal = useCallback(() => {
    setShowSubmissionModal(false);
    setSubmissionStep(1);
    setSubmissionType(null);
    setSubmissionForm(INITIAL_SUBMISSION_FORM);
    setShowImageCropper(false);
    setCropperImage(null);
  }, []);

  // Handle type selection
  const selectSubmissionType = useCallback((type) => {
    setSubmissionType(type);
    setSubmissionStep(2);
  }, []);

  // Handle business type selection
  const selectBusinessType = useCallback((type, businessId = null) => {
    if (type === 'claimed' && businessId) {
      const business = userClaimedBusinesses?.find(b => b.id === businessId);
      setSubmissionForm(prev => ({
        ...prev,
        businessType: 'claimed',
        selectedBusinessId: businessId,
        businessName: business?.name || '',
        businessAddress: business?.address || ''
      }));
    } else if (type === 'new') {
      setSubmissionForm(prev => ({
        ...prev,
        businessType: 'new',
        selectedBusinessId: '',
        businessName: '',
        businessAddress: ''
      }));
    } else if (type === 'individual') {
      setSubmissionForm(prev => ({
        ...prev,
        businessType: 'individual',
        selectedBusinessId: '',
        businessName: user?.name,
        businessAddress: 'Squamish, BC'
      }));
    }
  }, [userClaimedBusinesses, user?.name]);

  // Handle image selection (opens cropper)
  const handleImageSelect = useCallback((e, imageType) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCropperImage(event.target.result);
        setCropperType(imageType);
        setCropPosition({ x: 0, y: 0 });
        setCropZoom(1);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Handle crop completion
  const handleCropComplete = useCallback(async () => {
    const cropData = {
      image: cropperImage,
      position: cropPosition,
      zoom: cropZoom,
      type: cropperType
    };

    if (cropperType === 'square') {
      setSubmissionForm(prev => ({
        ...prev,
        squareImage: cropData,
        squareImagePreview: cropperImage
      }));
    } else if (cropperType === 'banner') {
      setSubmissionForm(prev => ({
        ...prev,
        bannerImage: cropData,
        bannerImagePreview: cropperImage
      }));
    } else if (cropperType === 'profileAvatar') {
      const response = await fetch(cropperImage);
      const blob = await response.blob();
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const { error } = await updateAvatar?.(file);
      showToast?.(error ? 'Error uploading avatar. Please try again.' : 'Profile photo updated!');
    } else if (cropperType === 'profileCover') {
      const response = await fetch(cropperImage);
      const blob = await response.blob();
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
      const { error } = await updateCoverPhoto?.(file);
      showToast?.(error ? 'Error uploading cover photo. Please try again.' : 'Cover photo updated!');
    }

    setShowImageCropper(false);
    setCropperImage(null);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
  }, [cropperImage, cropPosition, cropZoom, cropperType, updateAvatar, updateCoverPhoto, showToast]);

  // Remove image from submission form
  const removeImage = useCallback((imageType) => {
    if (imageType === 'square') {
      setSubmissionForm(prev => ({ ...prev, squareImage: null, squareImagePreview: '' }));
    } else if (imageType === 'banner') {
      setSubmissionForm(prev => ({ ...prev, bannerImage: null, bannerImagePreview: '' }));
    }
  }, []);

  // Get selected business info
  const getSelectedBusinessInfo = useCallback(() => {
    if (submissionForm.businessType === 'claimed') {
      return userClaimedBusinesses?.find(b => b.id === submissionForm.selectedBusinessId);
    }
    return null;
  }, [submissionForm.businessType, submissionForm.selectedBusinessId, userClaimedBusinesses]);

  // Submit for admin approval
  const submitForApproval = useCallback(async () => {
    const selectedBusiness = getSelectedBusinessInfo();
    try {
      // Rate limit check: 5 submissions per hour
      if (user?.id) {
        const { data: rl } = await supabase.rpc('check_and_record_rate_limit', {
          p_user_id: user.id,
          p_action: 'submit_item',
          p_max_attempts: 5,
          p_window_minutes: 60
        });
        if (rl && !rl.allowed) {
          const mins = Math.ceil(rl.retry_after_seconds / 60);
          showToast?.(`Too many submissions. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`, 'error');
          return;
        }
      }

      const submissionData = {
        item_type: submissionType,
        action: 'create',
        data: {
          ...submissionForm,
          submittedBy: { name: user?.name, email: user?.email },
          business: {
            type: submissionForm.businessType,
            name: submissionForm.businessName || selectedBusiness?.name,
            address: submissionForm.businessAddress,
            verified: selectedBusiness?.verified || false
          },
          images: {
            square: submissionForm.squareImagePreview,
            banner: submissionForm.bannerImagePreview
          }
        },
        source: 'web_app',
        business_id: selectedBusiness?.id || null,
        submitted_by: user?.id || null,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('pending_items')
        .insert(submissionData)
        .select()
        .single();

      if (error) throw error;

      setPendingSubmissions(prev => [...prev, {
        id: data.id,
        type: data.item_type,
        status: data.status,
        submittedAt: new Date(data.created_at),
        submittedBy: { name: user?.name, email: user?.email },
        business: submissionData.data.business,
        data: data.data,
        images: submissionData.data.images
      }]);

      setSubmissionStep(3);
      showToast?.('Submission sent for review!', 'success');
    } catch (err) {
      console.error('Submission error:', err);
      showToast?.('Failed to submit. Please try again.', 'error');
    }
  }, [getSelectedBusinessInfo, submissionType, submissionForm, user?.name, user?.email, user?.id, showToast]);

  // Admin: Approve submission
  const approveSubmission = useCallback(async (submissionId) => {
    try {
      const submission = pendingSubmissions.find(s => s.id === submissionId);
      if (!submission) return;

      const { error: updateError } = await supabase
        .from('pending_items')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      if (submission.type === 'event' || submission.type === 'class') {
        const eventData = {
          title: submission.data.title,
          description: submission.data.description,
          start_date: submission.data.date,
          start_time: submission.data.startTime,
          end_time: submission.data.endTime,
          venue_name: submission.data.businessName || submission.business?.name,
          venue_id: submission.business_id,
          event_type: submission.type,
          category: submission.data.category,
          price: submission.data.price,
          recurrence: submission.data.recurrence,
          tags: ['user-submitted'],
          status: 'active'
        };

        const { error: insertError } = await supabase.from('events').insert(eventData);
        if (insertError) throw insertError;
      } else if (submission.type === 'deal') {
        const dealData = {
          title: submission.data.title,
          description: submission.data.description,
          business_name: submission.data.businessName || submission.data.business?.name || '',
          business_address: submission.data.businessAddress || submission.data.business?.address || '',
          category: submission.data.category || 'General',
          discount_type: submission.data.discountType || 'special',
          discount_value: submission.data.discountValue ? parseFloat(submission.data.discountValue) : null,
          original_price: submission.data.originalPrice ? parseFloat(submission.data.originalPrice) : null,
          deal_price: submission.data.dealPrice ? parseFloat(submission.data.dealPrice) : null,
          valid_until: submission.data.validUntil || null,
          terms_conditions: submission.data.terms || '',
          schedule: submission.data.schedule || '',
          status: 'active'
        };

        const { error: insertError } = await supabase.from('deals').insert(dealData);
        if (insertError) throw insertError;
      }

      setPendingSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: 'approved', approvedAt: new Date() } : s)
      );

      showToast?.('Submission approved and published!', 'success');
    } catch (_err) {
      showToast?.('Failed to approve. Please try again.', 'error');
    }
  }, [pendingSubmissions, user?.id, showToast]);

  // Admin: Reject submission
  const rejectSubmission = useCallback(async (submissionId, reason) => {
    try {
      const { error } = await supabase
        .from('pending_items')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason
        })
        .eq('id', submissionId);

      if (error) throw error;

      setPendingSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: 'rejected', rejectedAt: new Date(), rejectReason: reason } : s)
      );

      showToast?.('Submission rejected.', 'info');
    } catch (err) {
      console.error('Rejection error:', err);
      showToast?.('Failed to reject. Please try again.', 'error');
    }
  }, [user?.id, showToast]);

  // Load pending submissions from database
  const loadPendingSubmissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pending_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setPendingSubmissions(data.map(item => ({
          id: item.id,
          type: item.item_type,
          status: item.status,
          submittedAt: new Date(item.created_at),
          submittedBy: item.data?.submittedBy || { name: 'Unknown', email: '' },
          business: item.data?.business || {},
          data: item.data || {},
          images: item.data?.images || {},
          rejectReason: item.review_notes
        })));
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  }, []);

  // Close image cropper
  const closeImageCropper = useCallback(() => {
    setShowImageCropper(false);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
  }, []);

  return {
    // Submission state
    showSubmissionModal, setShowSubmissionModal,
    submissionStep, setSubmissionStep,
    submissionType, setSubmissionType,
    submissionForm, setSubmissionForm,
    pendingSubmissions, setPendingSubmissions,

    // Image cropper state
    showImageCropper, setShowImageCropper,
    cropperType, setCropperType,
    cropperImage, setCropperImage,
    cropPosition, setCropPosition,
    cropZoom, setCropZoom,

    // Functions
    openSubmissionModal,
    closeSubmissionModal,
    selectSubmissionType,
    selectBusinessType,
    handleImageSelect,
    handleCropComplete,
    removeImage,
    getSelectedBusinessInfo,
    submitForApproval,
    approveSubmission,
    rejectSubmission,
    loadPendingSubmissions,
    closeImageCropper,
  };
}
