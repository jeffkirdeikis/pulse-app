import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

serve(async (req) => {
  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const { claimId } = await req.json()
    if (!claimId) {
      return new Response(JSON.stringify({ error: 'Missing claimId' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch claim
    const { data: claim, error: fetchErr } = await supabase
      .from('business_claims')
      .select('id, user_id, status, contact_email, business_name, owner_name, created_at')
      .eq('id', claimId)
      .single()

    if (fetchErr || !claim) {
      return new Response(JSON.stringify({ error: 'Claim not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (claim.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (claim.status !== 'pending_verification') {
      return new Response(JSON.stringify({ error: 'Claim is not pending verification' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    // Generate new code server-side
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    const newCode = (100000 + (array[0] % 900000)).toString()

    // Update code and reset attempts
    await supabase.from('business_claims').update({
      verification_code: newCode,
      verification_attempts: 0,
    }).eq('id', claimId)

    // Send email
    const safeName = escapeHtml(claim.owner_name || 'there')
    const safeBusiness = escapeHtml(claim.business_name || 'a business')

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Pulse</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Business Verification</p>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">Hi ${safeName},</p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            You're claiming <strong style="color: #111827;">${safeBusiness}</strong> on Pulse. Enter this code to verify your email:
          </p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">${newCode}</span>
          </div>
          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
            This code expires in 24 hours. If you didn't request this, you can ignore this email.
          </p>
        </div>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pulse <noreply@pulse-app.ca>',
        to: [claim.contact_email],
        subject: 'Verify your business claim on Pulse',
        html: htmlBody,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.json()
      console.error('Resend error:', errBody)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
