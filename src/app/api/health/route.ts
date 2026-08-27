import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/health — diagnóstico de configuración (NO expone valores secretos,
// solo si están presentes) + estado de las tablas en Supabase.
export async function GET() {
  const env = {
    SUPABASE_URL:         !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    SF_USERNAME:          !!process.env.SF_USERNAME,
    SF_PASSWORD:          !!process.env.SF_PASSWORD,
    SF_TOKEN:             !!process.env.SF_TOKEN,
    CRON_SECRET:          !!process.env.CRON_SECRET,
  }

  let db: { ok: boolean; clientes: number | null; casos: number | null; error: string | null } = {
    ok: false, clientes: null, casos: null, error: null,
  }
  try {
    const { supabaseServer } = await import('@/lib/supabase')
    const sb = supabaseServer()
    const clientes = await sb.from('clientes').select('*', { count: 'exact', head: true })
    const casos    = await sb.from('casos').select('*', { count: 'exact', head: true })
    db = {
      ok:       !clientes.error && !casos.error,
      clientes: clientes.count ?? null,
      casos:    casos.count ?? null,
      error:    clientes.error?.message || casos.error?.message || null,
    }
  } catch (e: any) {
    db.error = e.message
  }

  const listo = env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY && db.ok
  return NextResponse.json({ ok: true, listo, env, db, at: new Date().toISOString() })
}
