import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mepsuigcvritvwnjnefz.supabase.co'
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRole) {
    throw new Error('Config ausente: defina SUPABASE_SERVICE_ROLE_KEY para criar logins de usuarios.')
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
