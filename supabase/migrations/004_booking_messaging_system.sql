-- ============================================================================
-- PULSE APP - ENHANCED BOOKING & MESSAGING SYSTEM
-- Migration 004: Conversations, Messages, Push Notifications
-- ============================================================================

-- 1. CONVERSATIONS TABLE (Thread-based messaging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Conversation metadata
    subject text,  -- Optional subject line
    conversation_type text DEFAULT 'inquiry' CHECK (conversation_type IN ('inquiry', 'booking', 'support', 'general')),

    -- Related booking (if any)
    booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,

    -- Status tracking
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'resolved', 'spam')),

    -- Read status (separate for each party)
    user_last_read_at timestamptz,
    business_last_read_at timestamptz,

    -- Counts (denormalized for performance)
    message_count integer DEFAULT 0,
    unread_user_count integer DEFAULT 0,  -- Messages unread by user
    unread_business_count integer DEFAULT 0,  -- Messages unread by business

    -- Last message preview
    last_message_at timestamptz,
    last_message_preview text,
    last_message_from text,  -- 'user' or 'business'

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(business_id, user_id)  -- One conversation per user-business pair
);

CREATE INDEX idx_conversations_business ON conversations(business_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread_business ON conversations(business_id, unread_business_count) WHERE unread_business_count > 0;
CREATE INDEX idx_conversations_unread_user ON conversations(user_id, unread_user_count) WHERE unread_user_count > 0;


-- 2. MESSAGES TABLE (Individual messages in conversations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Sender info
    sender_type text NOT NULL CHECK (sender_type IN ('user', 'business', 'system')),
    sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Message content
    content text NOT NULL,
    message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'booking_request', 'booking_confirmation', 'system')),

    -- Attachments
    attachments jsonb DEFAULT '[]',  -- [{type: 'image', url: '...', name: '...'}, ...]

    -- Metadata for special message types
    metadata jsonb DEFAULT '{}',  -- For booking details, etc.

    -- Read/delivery status
    delivered_at timestamptz DEFAULT now(),
    read_at timestamptz,

    -- Soft delete
    deleted_at timestamptz,
    deleted_by text,  -- 'user' or 'business'

    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;


-- 3. ADD BOOKING FIELDS TO BUSINESSES
-- ============================================================================
DO $$
BEGIN
    -- Add booking_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'businesses' AND column_name = 'booking_url') THEN
        ALTER TABLE businesses ADD COLUMN booking_url text;
    END IF;

    -- Add booking_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'businesses' AND column_name = 'booking_type') THEN
        ALTER TABLE businesses ADD COLUMN booking_type text DEFAULT 'external'
            CHECK (booking_type IN ('external', 'in_app', 'phone', 'email', 'none'));
    END IF;

    -- Add messaging_enabled if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'businesses' AND column_name = 'messaging_enabled') THEN
        ALTER TABLE businesses ADD COLUMN messaging_enabled boolean DEFAULT true;
    END IF;

    -- Add auto_reply_enabled if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'businesses' AND column_name = 'auto_reply_enabled') THEN
        ALTER TABLE businesses ADD COLUMN auto_reply_enabled boolean DEFAULT false;
    END IF;

    -- Add auto_reply_message if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'businesses' AND column_name = 'auto_reply_message') THEN
        ALTER TABLE businesses ADD COLUMN auto_reply_message text;
    END IF;
END $$;


-- 4. PUSH NOTIFICATION SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Push token info
    push_token text,
    platform text CHECK (platform IN ('ios', 'android', 'web')),
    device_id text,

    -- Notification preferences
    enabled boolean DEFAULT true,

    -- Granular settings
    notify_new_messages boolean DEFAULT true,
    notify_booking_updates boolean DEFAULT true,
    notify_deal_alerts boolean DEFAULT true,
    notify_event_reminders boolean DEFAULT true,
    notify_business_replies boolean DEFAULT true,

    -- Quiet hours
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time DEFAULT '22:00',
    quiet_hours_end time DEFAULT '08:00',

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(user_id, device_id)
);

CREATE INDEX idx_push_settings_user ON push_notification_settings(user_id);
CREATE INDEX idx_push_settings_token ON push_notification_settings(push_token) WHERE push_token IS NOT NULL;


-- 5. BUSINESS NOTIFICATION SETTINGS (for business owners)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- Business owner

    -- Push token
    push_token text,
    platform text CHECK (platform IN ('ios', 'android', 'web')),

    -- Notification preferences
    notify_new_inquiries boolean DEFAULT true,
    notify_new_bookings boolean DEFAULT true,
    notify_booking_changes boolean DEFAULT true,
    notify_new_reviews boolean DEFAULT true,
    notify_mentions boolean DEFAULT true,

    -- Email digest
    email_digest_enabled boolean DEFAULT true,
    email_digest_frequency text DEFAULT 'daily' CHECK (email_digest_frequency IN ('realtime', 'hourly', 'daily', 'weekly')),

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(business_id, user_id)
);

CREATE INDEX idx_business_notify_business ON business_notification_settings(business_id);


-- 6. MESSAGE ANALYTICS (for response time tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,

    -- Timing
    inquiry_received_at timestamptz NOT NULL,
    first_response_at timestamptz,
    response_time_seconds integer,

    -- Context
    inquiry_type text,  -- 'booking', 'question', 'support'
    responded boolean DEFAULT false,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_message_analytics_business ON message_analytics(business_id);
CREATE INDEX idx_message_analytics_date ON message_analytics(inquiry_received_at);


-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- 7. CREATE OR GET CONVERSATION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_user_id uuid,
    p_business_id uuid,
    p_conversation_type text DEFAULT 'inquiry',
    p_subject text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation_id uuid;
BEGIN
    -- Try to find existing conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE user_id = p_user_id AND business_id = p_business_id;

    -- Create new if not found
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (user_id, business_id, conversation_type, subject)
        VALUES (p_user_id, p_business_id, p_conversation_type, p_subject)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;


-- 8. SEND MESSAGE
-- ============================================================================
CREATE OR REPLACE FUNCTION send_message(
    p_conversation_id uuid,
    p_sender_id uuid,
    p_sender_type text,
    p_content text,
    p_message_type text DEFAULT 'text',
    p_attachments jsonb DEFAULT '[]',
    p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id uuid;
    v_conversation record;
    v_business_id uuid;
    v_preview text;
BEGIN
    -- Get conversation
    SELECT * INTO v_conversation FROM conversations WHERE id = p_conversation_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Conversation not found');
    END IF;

    v_business_id := v_conversation.business_id;

    -- Validate sender belongs to conversation
    IF p_sender_type = 'user' AND p_sender_id != v_conversation.user_id THEN
        RETURN jsonb_build_object('error', 'Unauthorized');
    END IF;

    -- Create message preview (first 100 chars)
    v_preview := LEFT(p_content, 100);
    IF LENGTH(p_content) > 100 THEN
        v_preview := v_preview || '...';
    END IF;

    -- Insert message
    INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, attachments, metadata)
    VALUES (p_conversation_id, p_sender_type, p_sender_id, p_content, p_message_type, p_attachments, p_metadata)
    RETURNING id INTO v_message_id;

    -- Update conversation
    UPDATE conversations SET
        message_count = message_count + 1,
        last_message_at = NOW(),
        last_message_preview = v_preview,
        last_message_from = p_sender_type,
        unread_user_count = CASE WHEN p_sender_type = 'business' THEN unread_user_count + 1 ELSE unread_user_count END,
        unread_business_count = CASE WHEN p_sender_type = 'user' THEN unread_business_count + 1 ELSE unread_business_count END,
        updated_at = NOW()
    WHERE id = p_conversation_id;

    -- Track analytics for business response time
    IF p_sender_type = 'user' THEN
        INSERT INTO message_analytics (business_id, conversation_id, inquiry_received_at, inquiry_type)
        VALUES (v_business_id, p_conversation_id, NOW(), p_message_type);
    ELSIF p_sender_type = 'business' THEN
        -- Update response time for most recent unanswered inquiry
        UPDATE message_analytics SET
            first_response_at = NOW(),
            response_time_seconds = EXTRACT(EPOCH FROM (NOW() - inquiry_received_at))::integer,
            responded = true
        WHERE conversation_id = p_conversation_id
        AND responded = false
        AND id = (
            SELECT id FROM message_analytics
            WHERE conversation_id = p_conversation_id AND responded = false
            ORDER BY inquiry_received_at DESC LIMIT 1
        );
    END IF;

    -- Check for auto-reply
    IF p_sender_type = 'user' THEN
        DECLARE
            v_auto_reply text;
            v_auto_enabled boolean;
        BEGIN
            SELECT auto_reply_enabled, auto_reply_message
            INTO v_auto_enabled, v_auto_reply
            FROM businesses WHERE id = v_business_id;

            IF v_auto_enabled AND v_auto_reply IS NOT NULL THEN
                -- Send auto-reply as system message
                INSERT INTO messages (conversation_id, sender_type, content, message_type, metadata)
                VALUES (p_conversation_id, 'system', v_auto_reply, 'text', '{"auto_reply": true}'::jsonb);

                UPDATE conversations SET message_count = message_count + 1 WHERE id = p_conversation_id;
            END IF;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', v_message_id,
        'conversation_id', p_conversation_id
    );
END;
$$;


-- 9. MARK MESSAGES AS READ
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_conversation_read(
    p_conversation_id uuid,
    p_reader_type text  -- 'user' or 'business'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark all messages as read
    UPDATE messages SET read_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND read_at IS NULL
    AND sender_type != p_reader_type;

    -- Update conversation read counts
    IF p_reader_type = 'user' THEN
        UPDATE conversations SET
            user_last_read_at = NOW(),
            unread_user_count = 0
        WHERE id = p_conversation_id;
    ELSE
        UPDATE conversations SET
            business_last_read_at = NOW(),
            unread_business_count = 0
        WHERE id = p_conversation_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 10. GET USER CONVERSATIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'business_id', c.business_id,
                'business_name', b.name,
                'business_image', b.google_photo_url,
                'subject', c.subject,
                'status', c.status,
                'unread_count', c.unread_user_count,
                'last_message_at', c.last_message_at,
                'last_message_preview', c.last_message_preview,
                'last_message_from', c.last_message_from,
                'created_at', c.created_at
            ) ORDER BY c.last_message_at DESC NULLS LAST
        ), '[]'::jsonb)
        FROM conversations c
        JOIN businesses b ON b.id = c.business_id
        WHERE c.user_id = p_user_id AND c.status != 'spam'
    );
END;
$$;


-- 11. GET BUSINESS INBOX
-- ============================================================================
CREATE OR REPLACE FUNCTION get_business_inbox(
    p_business_id uuid,
    p_filter text DEFAULT 'all'  -- 'all', 'unread', 'booking', 'archived'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'user_id', c.user_id,
                'user_name', p.full_name,
                'user_avatar', p.avatar_url,
                'conversation_type', c.conversation_type,
                'subject', c.subject,
                'status', c.status,
                'unread_count', c.unread_business_count,
                'last_message_at', c.last_message_at,
                'last_message_preview', c.last_message_preview,
                'last_message_from', c.last_message_from,
                'booking_id', c.booking_id,
                'created_at', c.created_at
            ) ORDER BY c.last_message_at DESC NULLS LAST
        ), '[]'::jsonb)
        FROM conversations c
        JOIN profiles p ON p.id = c.user_id
        WHERE c.business_id = p_business_id
        AND (
            p_filter = 'all' OR
            (p_filter = 'unread' AND c.unread_business_count > 0) OR
            (p_filter = 'booking' AND c.conversation_type = 'booking') OR
            (p_filter = 'archived' AND c.status = 'archived')
        )
        AND (p_filter = 'archived' OR c.status != 'archived')
    );
END;
$$;


-- 12. GET CONVERSATION MESSAGES
-- ============================================================================
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_conversation_id uuid,
    p_limit integer DEFAULT 50,
    p_before_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'sender_type', m.sender_type,
                'sender_id', m.sender_id,
                'sender_name', CASE
                    WHEN m.sender_type = 'system' THEN 'System'
                    ELSE COALESCE(p.full_name, 'Unknown')
                END,
                'sender_avatar', p.avatar_url,
                'content', m.content,
                'message_type', m.message_type,
                'attachments', m.attachments,
                'metadata', m.metadata,
                'read_at', m.read_at,
                'created_at', m.created_at
            ) ORDER BY m.created_at ASC
        ), '[]'::jsonb)
        FROM messages m
        LEFT JOIN profiles p ON p.id = m.sender_id
        WHERE m.conversation_id = p_conversation_id
        AND m.deleted_at IS NULL
        AND (p_before_id IS NULL OR m.created_at < (SELECT created_at FROM messages WHERE id = p_before_id))
        ORDER BY m.created_at DESC
        LIMIT p_limit
    );
END;
$$;


-- 13. GET TOTAL UNREAD COUNT FOR USER
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_unread_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT COALESCE(SUM(unread_user_count), 0)::integer INTO v_count
    FROM conversations
    WHERE user_id = p_user_id AND status != 'spam';

    RETURN v_count;
END;
$$;


-- 14. GET TOTAL UNREAD COUNT FOR BUSINESS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_business_unread_count(p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT COALESCE(SUM(unread_business_count), 0)::integer INTO v_count
    FROM conversations
    WHERE business_id = p_business_id AND status NOT IN ('spam', 'archived');

    RETURN v_count;
END;
$$;


-- 15. ARCHIVE CONVERSATION
-- ============================================================================
CREATE OR REPLACE FUNCTION archive_conversation(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conversations SET status = 'archived', updated_at = NOW()
    WHERE id = p_conversation_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 16. UPDATE ENHANCED BOOKINGS TABLE
-- ============================================================================
DO $$
BEGIN
    -- Add conversation_id to bookings if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings' AND column_name = 'conversation_id') THEN
        ALTER TABLE bookings ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;
    END IF;

    -- Add source tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'bookings' AND column_name = 'source') THEN
        ALTER TABLE bookings ADD COLUMN source text DEFAULT 'in_app';
    END IF;
END $$;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_analytics ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can see their own, business owners can see their business's
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Business owners can view business conversations" ON conversations
    FOR SELECT USING (
        business_id IN (
            SELECT business_id FROM business_claims
            WHERE user_id = auth.uid() AND status = 'verified'
        )
    );

-- Messages: Visible to conversation participants
CREATE POLICY "Conversation participants can view messages" ON messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = auth.uid()
            UNION
            SELECT c.id FROM conversations c
            JOIN business_claims bc ON bc.business_id = c.business_id
            WHERE bc.user_id = auth.uid() AND bc.status = 'verified'
        )
    );

-- Push settings: Users manage their own
CREATE POLICY "Users manage own push settings" ON push_notification_settings
    FOR ALL USING (auth.uid() = user_id);

-- Business notification settings
CREATE POLICY "Business owners manage notification settings" ON business_notification_settings
    FOR ALL USING (auth.uid() = user_id);

-- Message analytics: Business owners only
CREATE POLICY "Business owners view message analytics" ON message_analytics
    FOR SELECT USING (
        business_id IN (
            SELECT business_id FROM business_claims
            WHERE user_id = auth.uid() AND status = 'verified'
        )
    );


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON conversations TO authenticated;
GRANT SELECT ON messages TO authenticated;
GRANT ALL ON push_notification_settings TO authenticated;
GRANT ALL ON business_notification_settings TO authenticated;
GRANT SELECT ON message_analytics TO authenticated;

GRANT EXECUTE ON FUNCTION get_or_create_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION send_message TO authenticated;
GRANT EXECUTE ON FUNCTION mark_conversation_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_inbox TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_unread_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_unread_count TO authenticated;
GRANT EXECUTE ON FUNCTION archive_conversation TO authenticated;


-- ============================================================================
-- DONE! Enhanced booking & messaging system ready.
-- ============================================================================
