import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAG = 1000

// Lista los clientes (cuenta) de un segmento con sus casos (total / abiertos).
// Sirve para entender por qué un segmento muestra pocos clientes en los visuales.
//   GET /api/seg-clientes?segmento=Élite   (Authorization: Bearer <CRON_SECRET>)
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function run(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  const segmento = new URL(req.url).searchParams.get('segmento') || 'Élite'
  try {
    const sb = supabaseServer()
    const map = new Map<string, { cliente: string; nit: string; total: number; abiertos: number }>()
    for (let desde = 0; ; desde += PAG) {
      const { data, error } = await sb.from('casos_segmentados')
        .select('cuenta_nombre, cliente_base, nit, nit_ext, abierto')
        .eq('segmento', segmento).order('id', { ascending: true }).range(desde, desde + PAG - 1)
      if (error) throw error
      for (const r of (data ?? []) as any[]) {
        const cliente = r.cuenta_nombre || r.cliente_base || r.nit || 'Sin nombre'
        const key = cliente
        let g = map.get(key)
        if (!g) { g = { cliente, nit: r.nit_ext || r.nit || '', total: 0, abiertos: 0 }; map.set(key, g) }
        g.total++
        if (r.abierto) g.abiertos++
      }
      if (!data || data.length < PAG) break
    }
    const clientes = [...map.values()].sort((a, b) => b.total - a.total)
    return NextResponse.json({
      ok: true, segmento,
      numClientes: clientes.length,
      totalCasos: clientes.reduce((a, c) => a + c.total, 0),
      abiertos: clientes.reduce((a, c) => a + c.abiertos, 0),
      clientes: clientes.slice(0, 40),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }
