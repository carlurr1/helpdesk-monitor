import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { SEGMENTOS } from '@/lib/segmentos'

export const dynamic = 'force-dynamic'

// GET /api/casos?segmento=Silver
// Devuelve KPIs + filas de la vista casos_segmentados (ya excluye Cancelado).
// Sin ?segmento (o segmento=Todos) devuelve todo + el desglose por segmento.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const segmento = searchParams.get('segmento')

  try {
    const sb = supabaseServer()
    let q = sb.from('casos_segmentados').select('*')
    if (segmento && segmento !== 'Todos') q = q.eq('segmento', segmento)

    const { data, error } = await q
    if (error) throw error
    const rows = data ?? []

    const kpis = {
      total:     rows.length,
      abiertos:  rows.filter((r: any) => r.abierto).length,
      cerrados:  rows.filter((r: any) => !r.abierto).length,
      ubicados:  rows.filter((r: any) => r.lat != null && r.lng != null).length,
    }

    // Desglose por segmento (para el selector/tarjetas de arriba).
    const porSegmento: Record<string, number> = {}
    for (const s of SEGMENTOS) porSegmento[s] = 0
    for (const r of rows as any[]) {
      const seg = r.segmento ?? 'Sin clasificar'
      porSegmento[seg] = (porSegmento[seg] || 0) + 1
    }

    return NextResponse.json({ ok: true, segmento: segmento || 'Todos', kpis, porSegmento, rows })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
