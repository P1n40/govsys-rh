import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mepsuigcvritvwnjnefz.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_d1rtrDFn5ox5QEsRdZ6_lQ_HHNsNFeH'

export const supabase = createClient(supabaseUrl, supabaseKey)
