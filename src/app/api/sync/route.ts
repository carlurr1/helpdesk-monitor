import { NextResponse } from 'next/server'
import { syncCasos } from '@/lib/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300   // el sync puede tardar; requiere plan Vercel Pro para >60s

// Protegido con CRON_SECRET. El cron de Vercel envía `Authorization: Bearer <CRON_SECRET>`.
// También sirve para disparo manual:  curl -H "Authorization: Bearer <secret>" .../api/sync
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false   // sin secreto configurado no se ejecuta (nunca abierto)
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function run(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { count, geocodificados } = await syncCasos()
    return NextResponse.json({ ok: true, count, geocodificados, at: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request)  { return run(req) }
export async function POST(req: Request) { return run(req) }
