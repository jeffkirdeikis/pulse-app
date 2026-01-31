import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useBusinesses({ category = null, search = '', limit = 100 } = {}) {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchBusinesses() {
      setLoading(true)
      let query = supabase
        .from('businesses')
        .select('*')
        .eq('status', 'active')

      if (category && category !== 'All') {
        query = query.eq('category', category)
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,address.ilike.%${search}%`)
      }

      query = query.order('google_rating', { ascending: false, nullsFirst: false }).limit(limit)

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setBusinesses(data || [])
      }
      setLoading(false)
    }

    fetchBusinesses()
  }, [category, search, limit])

  return { businesses, loading, error }
}
