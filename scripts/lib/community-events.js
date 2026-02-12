/**
 * Community Event Submission System
 * Allows users to submit events with AI-powered moderation
 */

import { createClient } from '@supabase/supabase-js';
import { validateEventWithAI } from './ai-extractor.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Process a community-submitted event
 * Returns: { status: 'approved' | 'review' | 'rejected', event, reason }
 */
export async function processSubmission(submission, userId) {
  const {
    title,
    description,
    date,
    time,
    venue_name,
    venue_address,
    price,
    category,
    source_url,
    image_url
  } = submission;

  // Build event object
  const event = {
    title,
    description,
    start_date: date,
    start_time: time,
    venue_name,
    venue_address,
    price_description: price,
    category,
    source_url,
    image_url,
    tags: ['community-submitted'],
    created_by: userId
  };

  // Get existing events for duplicate check
  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, title, start_date, start_time, venue_name')
    .eq('start_date', date)
    .eq('venue_name', venue_name);

  // AI validation
  const validation = await validateEventWithAI(event, existingEvents || []);

  // Determine action
  let status, reason;

  if (validation.is_duplicate_of) {
    status = 'rejected';
    reason = `Duplicate of existing event`;
  } else if (!validation.is_valid) {
    status = 'rejected';
    reason = validation.issues.join(', ');
  } else if (validation.confidence >= 0.85) {
    status = 'approved';
    reason = 'Auto-approved: High confidence';
  } else if (validation.confidence >= 0.6) {
    status = 'review';
    reason = 'Needs manual review: ' + (validation.issues[0] || 'Medium confidence');
  } else {
    status = 'rejected';
    reason = 'Low confidence: ' + validation.reasoning;
  }

  // Apply suggested fixes
  if (validation.suggested_fixes && Object.keys(validation.suggested_fixes).length > 0) {
    Object.assign(event, validation.suggested_fixes);
    event.tags.push('ai-corrected');
  }

  // Store submission
  const { data: submissionRecord, error } = await supabase
    .from('community_submissions')
    .insert({
      user_id: userId,
      event_data: event,
      status,
      ai_confidence: validation.confidence,
      ai_reasoning: validation.reasoning,
      ai_issues: validation.issues,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to store submission:', error);
    return { status: 'error', event, reason: error.message };
  }

  // If approved, insert the event
  if (status === 'approved') {
    const { error: insertError } = await supabase
      .from('events')
      .insert({
        ...event,
        status: 'active',
        community_submission_id: submissionRecord.id
      });

    if (insertError) {
      console.error('Failed to insert approved event:', insertError);
      status = 'error';
      reason = insertError.message;
    }
  }

  return { status, event, reason, submission_id: submissionRecord.id };
}

/**
 * Get pending submissions for admin review
 */
export async function getPendingSubmissions(limit = 50) {
  const { data, error } = await supabase
    .from('community_submissions')
    .select('*')
    .eq('status', 'review')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Admin: Approve a pending submission
 */
export async function approveSubmission(submissionId, adminId) {
  const { data: submission, error: fetchError } = await supabase
    .from('community_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (fetchError) throw fetchError;

  // Insert the event
  const { error: insertError } = await supabase
    .from('events')
    .insert({
      ...submission.event_data,
      status: 'active',
      community_submission_id: submissionId
    });

  if (insertError) throw insertError;

  // Update submission status
  await supabase
    .from('community_submissions')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submissionId);

  return { success: true };
}

/**
 * Admin: Reject a pending submission
 */
export async function rejectSubmission(submissionId, adminId, reason) {
  await supabase
    .from('community_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submissionId);

  return { success: true };
}

/**
 * User feedback: Flag incorrect event
 */
export async function flagEvent(eventId, userId, issueType, description) {
  const validIssues = [
    'wrong_date',
    'wrong_time',
    'wrong_location',
    'cancelled',
    'duplicate',
    'spam',
    'other'
  ];

  if (!validIssues.includes(issueType)) {
    throw new Error('Invalid issue type');
  }

  const { data, error } = await supabase
    .from('event_flags')
    .insert({
      event_id: eventId,
      user_id: userId,
      issue_type: issueType,
      description,
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // If 3+ flags, auto-hide event for review
  const { count } = await supabase
    .from('event_flags')
    .select('*', { count: 'exact' })
    .eq('event_id', eventId)
    .eq('status', 'pending');

  if (count >= 3) {
    await supabase
      .from('events')
      .update({ status: 'flagged' })
      .eq('id', eventId);
  }

  return data;
}

export default {
  processSubmission,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  flagEvent
};
