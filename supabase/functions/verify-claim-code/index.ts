import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create anon client to verify the JWT and get the user
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { claimId, code } = await req.json()

    if (!claimId || !code) {
      return new Response(JSON.stringify({ error: 'Missing claimId or code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use service role to read the claim (verification_code is never sent to client)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: claim, error: fetchErr } = await supabase
      .from('business_claims')
      .select('id, user_id, verification_code, verification_attempts, status, created_at')
      .eq('id', claimId)
      .single()

    if (fetchErr || !claim) {
      return new Response(JSON.stringify({ error: 'Claim not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Ensure the caller owns this claim
    if (claim.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Ensure claim is in pending_verification status
    if (claim.status !== 'pending_verification') {
      return new Response(JSON.stringify({ error: 'Claim is not pending verification', status: claim.status }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check code expiration (24 hours)
    const createdAt = new Date(claim.created_at)
    const now = new Date()
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceCreation > 24) {
      return new Response(JSON.stringify({ error: 'Code has expired. Please resend to get a new code.', expired: true }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check attempt limit
    if (claim.verification_attempts >= 5) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please resend the code.', locked: true }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Compare code
    if (code === claim.verification_code) {
      // Success — update status to pending (admin review)
      await supabase.from('business_claims').update({
        status: 'pending',
        verified_at: new Date().toISOString(),
      }).eq('id', claimId)

      return new Response(JSON.stringify({ success: true, verified: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      // Wrong code — increment attempts
      await supabase.from('business_claims').update({
        verification_attempts: (claim.verification_attempts || 0) + 1,
      }).eq('id', claimId)

      const remaining = 4 - (claim.verification_attempts || 0)
      return new Response(JSON.stringify({
        success: false,
        verified: false,
        attemptsRemaining: Math.max(remaining, 0),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
