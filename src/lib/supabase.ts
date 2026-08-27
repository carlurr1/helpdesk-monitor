import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente de SERVIDOR (service_role): solo en rutas API / scripts de sync/ingesta.
// NUNCA importar esto en un componente de cliente — expondría la llave secreta.
export function supabaseServer(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Cliente de NAVEGADOR (anon): lectura desde el front.
export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  return createClient(url, key)
}
