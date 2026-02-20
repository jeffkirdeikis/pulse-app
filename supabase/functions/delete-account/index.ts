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

    const userId = user.id

    // Use service role client for admin operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Clean up storage files (avatars and cover photos)
    try {
      const { data: avatarFiles } = await supabase.storage
        .from('avatars')
        .list(userId)

      if (avatarFiles && avatarFiles.length > 0) {
        const filePaths = avatarFiles.map(f => `${userId}/${f.name}`)
        await supabase.storage.from('avatars').remove(filePaths)
      }
    } catch (storageErr) {
      // Storage cleanup is best-effort — don't block deletion
      console.error('Storage cleanup error (avatars):', storageErr)
    }

    // Clean up claim documents
    try {
      const { data: claimFiles } = await supabase.storage
        .from('claim-documents')
        .list(userId)

      if (claimFiles && claimFiles.length > 0) {
        const filePaths = claimFiles.map(f => `${userId}/${f.name}`)
        await supabase.storage.from('claim-documents').remove(filePaths)
      }
    } catch (storageErr) {
      console.error('Storage cleanup error (claims):', storageErr)
    }

    // Delete the auth user — this cascades to profiles and all related tables
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Delete user error:', deleteError)
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
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
