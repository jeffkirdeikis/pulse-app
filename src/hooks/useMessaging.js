import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for all messaging/conversation state and functions.
 * Uses Supabase RPCs matching the production API (not direct table queries).
 *
 * @param {Object} user - Current user from useUserData
 * @param {Object} options
 * @param {Function} options.showToast - Toast display callback
 * @param {Function} options.onAuthRequired - Called when guest tries to access messages
 * @param {Object|null} options.activeBusiness - Currently active business (for business inbox)
 * @param {Function} options.trackAnalytics - Analytics tracking callback
 */
export function useMessaging(user, { showToast, onAuthRequired, activeBusiness, trackAnalytics } = {}) {
  // User conversations state
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Contact sheet state
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [contactBusiness, setContactBusiness] = useState(null);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  // Business inbox state
  const [businessInboxTab, setBusinessInboxTab] = useState('bookings');
  const [businessConversations, setBusinessConversations] = useState([]);
  const [businessConversationsLoading, setBusinessConversationsLoading] = useState(false);
  const [selectedBusinessConversation, setSelectedBusinessConversation] = useState(null);
  const [businessMessages, setBusinessMessages] = useState([]);
  const [businessMessagesLoading, setBusinessMessagesLoading] = useState(false);
  const [businessReplyInput, setBusinessReplyInput] = useState('');

  // Fetch user conversations
  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setConversationsLoading(false);
      return;
    }
    setConversationsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: user.id });
      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [user?.id]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: 50
      });
      if (error) throw error;
      setConversationMessages(data || []);
      // Mark as read
      await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
        p_reader_type: 'user'
      });
    } catch (err) {
      console.error('Error fetching messages:', err);
      setConversationMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Send a message in current conversation
  const sendMessage = useCallback(async () => {
    if (!messageInput.trim() || !currentConversation || sendingMessage || !user?.id) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase.rpc('send_message', {
        p_conversation_id: currentConversation.id,
        p_sender_id: user.id,
        p_sender_type: 'user',
        p_content: messageInput.trim()
      });
      if (error) throw error;
      setMessageInput('');
      await fetchMessages(currentConversation.id);
    } catch (err) {
      console.error('Error sending message:', err);
      showToast?.('Failed to send message. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [messageInput, currentConversation, sendingMessage, user?.id, fetchMessages, showToast]);

  // Start a new conversation with a business
  const startConversation = useCallback(async (businessId, subject, initialMessage) => {
    if (!user?.id || !businessId) return null;
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        p_user_id: user.id,
        p_business_id: businessId,
        p_subject: subject,
        p_initial_message: initialMessage
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error starting conversation:', err);
      return null;
    }
  }, [user?.id]);

  // Submit contact form
  const submitContactForm = useCallback(async () => {
    if (!contactMessage.trim() || !contactBusiness) return;
    setSendingMessage(true);
    try {
      const conversationId = await startConversation(
        contactBusiness.id,
        contactSubject || `Inquiry about ${contactBusiness.name}`,
        contactMessage.trim()
      );
      if (conversationId) {
        trackAnalytics?.('message_received', contactBusiness.id);
        setShowContactSheet(false);
        setContactBusiness(null);
        setContactSubject('');
        setContactMessage('');
        showToast?.('Message sent!');
      }
    } catch (err) {
      console.error('Error submitting contact form:', err);
      showToast?.('Failed to send message. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [contactMessage, contactBusiness, contactSubject, startConversation, trackAnalytics, showToast]);

  // Open messages modal (with auth check)
  const openMessages = useCallback(() => {
    if (user?.isGuest) {
      onAuthRequired?.();
      return;
    }
    fetchConversations();
    setShowMessagesModal(true);
    setCurrentConversation(null);
  }, [user?.isGuest, onAuthRequired, fetchConversations]);

  // Fetch business inbox conversations
  const fetchBusinessInbox = useCallback(async (businessId, type = 'all') => {
    if (!businessId) return;
    setBusinessConversationsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_business_inbox', {
        p_business_id: businessId,
        p_filter_type: type === 'all' ? null : type
      });
      if (error) throw error;
      setBusinessConversations(data || []);
    } catch (err) {
      console.error('Error fetching business inbox:', err);
      setBusinessConversations([]);
    } finally {
      setBusinessConversationsLoading(false);
    }
  }, []);

  // Fetch messages for a business conversation
  const fetchBusinessMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setBusinessMessagesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: 50
      });
      if (error) throw error;
      setBusinessMessages(data || []);
      // Mark as read by business
      await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
        p_reader_type: 'business'
      });
    } catch (err) {
      console.error('Error fetching business messages:', err);
      setBusinessMessages([]);
    } finally {
      setBusinessMessagesLoading(false);
    }
  }, []);

  // Send reply from business
  const sendBusinessReply = useCallback(async () => {
    if (!businessReplyInput.trim() || !selectedBusinessConversation) return;
    setSendingMessage(true);
    try {
      const businessId = activeBusiness?.id;
      const { error } = await supabase.rpc('send_message', {
        p_conversation_id: selectedBusinessConversation.id,
        p_sender_id: businessId,
        p_sender_type: 'business',
        p_content: businessReplyInput.trim()
      });
      if (error) throw error;
      setBusinessReplyInput('');
      await fetchBusinessMessages(selectedBusinessConversation.id);
    } catch (err) {
      console.error('Error sending reply:', err);
      showToast?.('Failed to send reply. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [businessReplyInput, selectedBusinessConversation, activeBusiness?.id, fetchBusinessMessages, showToast]);

  // Mark conversation as resolved
  const markConversationResolved = useCallback(async (conversationId) => {
    try {
      await supabase
        .from('conversations')
        .update({ status: 'resolved' })
        .eq('id', conversationId);

      // Refresh inbox
      if (activeBusiness?.id) {
        fetchBusinessInbox(activeBusiness.id, businessInboxTab === 'bookings' ? 'booking_request' : 'general_inquiry');
      }
      setSelectedBusinessConversation(null);
    } catch (err) {
      console.error('Error marking resolved:', err);
    }
  }, [activeBusiness?.id, businessInboxTab, fetchBusinessInbox]);

  return {
    // User messages state
    showMessagesModal, setShowMessagesModal,
    conversations,
    conversationsLoading,
    currentConversation, setCurrentConversation,
    conversationMessages,
    messagesLoading,
    messageInput, setMessageInput,
    sendingMessage, setSendingMessage,

    // Contact sheet state
    showContactSheet, setShowContactSheet,
    contactBusiness, setContactBusiness,
    contactSubject, setContactSubject,
    contactMessage, setContactMessage,

    // Business inbox state
    businessInboxTab, setBusinessInboxTab,
    businessConversations,
    businessConversationsLoading,
    selectedBusinessConversation, setSelectedBusinessConversation,
    businessMessages,
    businessMessagesLoading,
    businessReplyInput, setBusinessReplyInput,

    // Functions
    fetchConversations,
    fetchMessages,
    sendMessage,
    startConversation,
    submitContactForm,
    openMessages,
    fetchBusinessInbox,
    fetchBusinessMessages,
    sendBusinessReply,
    markConversationResolved,
  };
}
