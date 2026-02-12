import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const NOTIFY_EMAIL = 'jeffreykirdeikis@gmail.com'

serve(async (req) => {
  try {
    const payload = await req.json()

    // Support both direct calls and database webhook format
    const record = payload.record || payload

    const { type, message, email, screenshot_url, page_url, user_agent, viewport, user_id, created_at } = record

    const typeLabel = type === 'bug' ? '🐛 Bug Report' : type === 'suggestion' ? '💡 Suggestion' : '💬 Comment'
    const subject = `[Pulse Feedback] New ${typeLabel}: "${(message || '').substring(0, 50)}${(message || '').length > 50 ? '...' : ''}"`

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #1e40af); padding: 24px; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 20px;">New Feedback on Pulse</h2>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #374151; width: 100px;">Type</td>
              <td style="padding: 8px 12px; color: #1f2937;">${typeLabel}</td>
            </tr>
            <tr style="background: white;">
              <td style="padding: 8px 12px; font-weight: 600; color: #374151; vertical-align: top;">Message</td>
              <td style="padding: 8px 12px; color: #1f2937; white-space: pre-wrap;">${(message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">Email</td>
              <td style="padding: 8px 12px; color: #1f2937;">${email || 'Anonymous'}</td>
            </tr>
            <tr style="background: white;">
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">Page</td>
              <td style="padding: 8px 12px; color: #2563eb;"><a href="${page_url || '#'}">${page_url || 'N/A'}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">Browser</td>
              <td style="padding: 8px 12px; color: #6b7280; font-size: 12px;">${user_agent || 'N/A'}</td>
            </tr>
            <tr style="background: white;">
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">Viewport</td>
              <td style="padding: 8px 12px; color: #1f2937;">${viewport || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">User</td>
              <td style="padding: 8px 12px; color: #1f2937;">${user_id || 'Not signed in'}</td>
            </tr>
            <tr style="background: white;">
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">Submitted</td>
              <td style="padding: 8px 12px; color: #1f2937;">${created_at ? new Date(created_at).toLocaleString('en-CA', { timeZone: 'America/Vancouver' }) : 'N/A'}</td>
            </tr>
            ${screenshot_url ? `
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #374151;">Screenshot</td>
              <td style="padding: 8px 12px;"><a href="${screenshot_url}" style="color: #2563eb;">View Screenshot</a></td>
            </tr>
            ` : ''}
          </table>
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
        from: 'Pulse Feedback <onboarding@resend.dev>',
        to: [NOTIFY_EMAIL],
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
