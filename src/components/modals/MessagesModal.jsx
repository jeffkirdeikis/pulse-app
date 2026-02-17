import React, { memo, useRef, useEffect } from 'react';
import { ChevronLeft, MessageCircle, Send } from 'lucide-react';

const MessagesModal = memo(function MessagesModal({
  currentConversation,
  setCurrentConversation,
  conversationsLoading,
  conversations,
  messagesLoading,
  conversationMessages,
  messageInput,
  setMessageInput,
  sendingMessage,
  onClose,
  fetchMessages,
  sendMessage,
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive or conversation opens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationMessages]);

  return (
    <div className="modal-overlay messages-modal-overlay" role="dialog" aria-modal="true" aria-label="Messages" onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setCurrentConversation(null); } }}>
      <div className="messages-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-btn messages-close" onClick={() => { onClose(); setCurrentConversation(null); }} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M1 13L13 1" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {!currentConversation ? (
          <>
            <div className="messages-header">
              <MessageCircle size={24} />
              <h2>Messages</h2>
            </div>

            <div className="conversations-list">
              {conversationsLoading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Loading conversations...</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="empty-state">
                  <MessageCircle size={48} />
                  <h3>No messages yet</h3>
                  <p>Start a conversation by contacting a business</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`conversation-item ${conv.unread_count > 0 ? 'unread' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setCurrentConversation(conv);
                      setMessageInput('');
                      fetchMessages(conv.id);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentConversation(conv); setMessageInput(''); fetchMessages(conv.id); } }}
                  >
                    <div className="conv-avatar">
                      {conv.business_name?.charAt(0) || 'B'}
                    </div>
                    <div className="conv-content">
                      <div className="conv-header">
                        <span className="conv-name">{conv.business_name}</span>
                        <span className="conv-time">
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="conv-preview">
                        {conv.last_message_preview || conv.subject || 'No messages yet'}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="unread-badge">{conv.unread_count}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="chat-header">
              <button type="button" className="back-btn" onClick={() => { setCurrentConversation(null); setMessageInput(''); }}>
                <ChevronLeft size={20} />
              </button>
              <div className="chat-info">
                <h3>{currentConversation.business_name}</h3>
                <span className="chat-subject">{currentConversation.subject}</span>
              </div>
            </div>

            <div className="messages-container">
              {messagesLoading ? (
                <div className="loading-state">
                  <div className="spinner" />
                </div>
              ) : conversationMessages.length === 0 ? (
                <div className="empty-chat">
                  <p>No messages in this conversation yet</p>
                </div>
              ) : (
                <>
                  {conversationMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`message-bubble ${msg.sender_type === 'user' ? 'sent' : 'received'}`}
                    >
                      <p>{msg.content}</p>
                      <span className="message-time">
                        {msg.created_at && !isNaN(new Date(msg.created_at).getTime()) ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="message-input-container">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && messageInput.trim() && !sendingMessage && sendMessage()}
                autoComplete="off"
                maxLength={2000}
                aria-label="Message"
              />
              <button
                type="button"
                className="send-btn"
                onClick={sendMessage}
                disabled={!messageInput.trim() || sendingMessage}
                aria-label="Send message"
              >
                <Send size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default MessagesModal;
