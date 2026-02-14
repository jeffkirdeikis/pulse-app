import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

serve(async (req) => {
  try {
    const { email, businessName, ownerName, verificationCode } = await req.json()

    if (!email || !verificationCode) {
      return new Response(JSON.stringify({ error: 'Missing email or verificationCode' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const safeName = escapeHtml(ownerName || 'there')
    const safeBusiness = escapeHtml(businessName || 'a business')
    const subject = `Verify your business claim on Pulse`

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
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">${verificationCode}</span>
          </div>
          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
            This code expires in 24 hours. If you didn't request this, you can ignore this email.
          </p>
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pulse <noreply@pulse-app.ca>',
        to: [email],
        subject,
        html: htmlBody,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('Resend error:', result)
      return new Response(JSON.stringify({ error: 'Email send failed', details: result }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
