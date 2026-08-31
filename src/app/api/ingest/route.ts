import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Recibe lotes de clientes ya normalizados desde la página /admin (navegador)
// y los upserta en Supabase. Protegido con CRON_SECRET (mismo que /api/sync).
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

export async function POST(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'Clave de admin incorrecta.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const clientes = Array.isArray(body?.clientes) ? body.clientes : null
    if (!clientes || !clientes.length) {
      return NextResponse.json({ ok: false, error: 'No llegaron clientes.' }, { status: 400 })
    }
    const sb = supabaseServer()
    const { error } = await sb.from('clientes').upsert(clientes, { onConflict: 'nit' })
    if (error) throw error
    return NextResponse.json({ ok: true, count: clientes.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
