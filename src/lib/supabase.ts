import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Config ausente: defina NEXT_PUBLIC_SUPABASE_URL no ambiente.')
}

if (!supabaseKey) {
  throw new Error('Config ausente: defina NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
