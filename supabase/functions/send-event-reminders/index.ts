import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// --- Base64URL helpers ---
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const raw = atob(base64 + padding)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// --- VAPID JWT (ES256) ---
async function generateVAPIDJWT(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:jeff@pulse-app.ca',
  }

  const enc = new TextEncoder()
  const headerB64 = b64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const rawKey = b64urlDecode(VAPID_PRIVATE_KEY)
  const key = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)
  )

  // Convert DER to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(sig)
  let r: Uint8Array, s: Uint8Array
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32)
    s = sigBytes.slice(32)
  } else {
    // DER format: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
    const rLen = sigBytes[3]
    const rStart = 4 + (rLen - 32)
    r = sigBytes.slice(rStart, rStart + 32)
    const sStart = 4 + rLen + 2
    const sLen = sigBytes[sStart - 1]
    const sActualStart = sStart + (sLen - 32)
    s = sigBytes.slice(sActualStart, sActualStart + 32)
  }
  const rawSig = new Uint8Array(64)
  rawSig.set(r)
  rawSig.set(s, 32)

  return `${signingInput}.${b64url(rawSig.buffer)}`
}

// --- Web Push Encryption (RFC 8291 / aes128gcm) ---
async function encryptPayload(
  plaintext: Uint8Array,
  authSecret: Uint8Array,
  subscriberPublicKey: Uint8Array,
): Promise<Uint8Array> {
  // Generate ephemeral ECDH keypair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )

  // Import subscriber's public key for ECDH
  const subKey = await crypto.subtle.importKey(
    'raw', subscriberPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subKey }, ephemeral.privateKey, 256
  ))

  // Export ephemeral public key (65 bytes uncompressed)
  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))

  // Random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Build info for IKM derivation: "WebPush: info\0" + subscriber_key + server_key
  const enc = new TextEncoder()
  const infoPrefix = enc.encode('WebPush: info\0')
  const authInfo = new Uint8Array(infoPrefix.length + subscriberPublicKey.length + serverPub.length)
  authInfo.set(infoPrefix)
  authInfo.set(subscriberPublicKey, infoPrefix.length)
  authInfo.set(serverPub, infoPrefix.length + subscriberPublicKey.length)

  // Step 1: Derive IKM from shared secret using auth_secret as salt
  const ecdhKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits'])
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo }, ecdhKey, 256
  ))

  // Step 2: Derive CEK (16 bytes) and nonce (12 bytes) from IKM
  const ikmKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])

  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
    ikmKey, 128
  ))

  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') },
    ikmKey, 96
  ))

  // Step 3: Pad plaintext + delimiter (0x02 = last record)
  const record = new Uint8Array(plaintext.length + 1)
  record.set(plaintext)
  record[plaintext.length] = 2

  // Step 4: AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, record
  ))

  // Step 5: Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65)
  const header = new Uint8Array(86)
  header.set(salt)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = 65
  header.set(serverPub, 21)

  // Final body = header + encrypted content
  const body = new Uint8Array(header.length + encrypted.length)
  body.set(header)
  body.set(encrypted, header.length)

  return body
}

// --- Send Push Notification ---
async function sendPushNotification(
  sub: { endpoint: string; auth: string; p256dh: string },
  payload: object,
): Promise<boolean> {
  try {
    const jwt = await generateVAPIDJWT(sub.endpoint)
    const plaintext = new TextEncoder().encode(JSON.stringify(payload))
    const encrypted = await encryptPayload(plaintext, b64urlDecode(sub.auth), b64urlDecode(sub.p256dh))

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': String(encrypted.length),
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: encrypted,
    })

    if (!res.ok && res.status !== 201) {
      const text = await res.text().catch(() => '')
      console.error(`Push failed ${res.status}: ${text}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Push send error:', err)
    return false
  }
}

// --- Main handler ---
serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find events starting in 45-75 minutes (30-min window for cron timing)
    const now = new Date()
    const from = new Date(now.getTime() + 45 * 60 * 1000)
    const to = new Date(now.getTime() + 75 * 60 * 1000)

    const fromTime = from.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit'
    })
    const toTime = to.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit'
    })
    const today = from.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

    console.log(`Checking reminders for ${today} between ${fromTime} and ${toTime}`)

    // Get calendar entries for events happening soon that haven't been reminded
    const { data: calendarEntries, error: calError } = await supabase
      .from('user_calendar')
      .select('id, user_id, event_name, event_time, venue_name')
      .eq('event_date', today)
      .gte('event_time', fromTime)
      .lte('event_time', toTime)
      .eq('status', 'registered')
      .or('reminder_sent.is.null,reminder_sent.eq.false')

    if (calError) {
      console.error('Calendar query error:', calError.message)
      return new Response(JSON.stringify({ sent: 0, error: calError.message }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!calendarEntries?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No upcoming events needing reminders' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    const reminded: string[] = []

    for (const entry of calendarEntries) {
      // Get push subscriptions for this user
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, auth, p256dh')
        .eq('user_id', entry.user_id)

      if (!subs?.length) continue

      // Check notification preferences (stored in profiles.notification_settings jsonb)
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_settings')
        .eq('id', entry.user_id)
        .single()

      const settings = profile?.notification_settings || {}
      // Default to enabled if not explicitly set
      if (settings.push_enabled === false || settings.event_reminders === false) continue

      const payload = {
        title: `${entry.event_name} starts in 1 hour`,
        body: entry.venue_name ? `at ${entry.venue_name}` : 'Get ready!',
        tag: `reminder-${entry.event_name}-${today}`,
        url: '/',
      }

      let delivered = false
      for (const sub of subs) {
        const ok = await sendPushNotification(sub, payload)
        if (ok) {
          sent++
          delivered = true
        }
      }

      // Mark reminder as sent
      reminded.push(entry.id)

      // Log notification
      await supabase.from('notifications').insert({
        user_id: entry.user_id,
        type: 'push',
        category: 'event_reminder',
        title: payload.title,
        body: payload.body,
        sent_at: new Date().toISOString(),
        delivered_at: delivered ? new Date().toISOString() : null,
        delivery_failed: !delivered,
      }).catch((err) => console.error('Notification log error:', err))
    }

    // Mark all entries as reminded
    if (reminded.length) {
      await supabase
        .from('user_calendar')
        .update({ reminder_sent: true })
        .in('id', reminded)
    }

    console.log(`Sent ${sent} push notifications for ${calendarEntries.length} calendar entries`)

    return new Response(JSON.stringify({ success: true, sent, checked: calendarEntries.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Reminder function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
