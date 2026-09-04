import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { SEGMENTOS } from '@/lib/segmentos'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const PAG = 1000 // Supabase corta cada consulta en 1000 filas: hay que paginar.

// Solo las columnas que usa el front (achica el payload: "Todos" son ~28k filas).
const COLS = [
  'id', 'numero', 'nit', 'cuenta_nombre', 'cliente_base', 'estado', 'categoria',
  'tipologia', 'abierto', 'fecha_apertura', 'fecha_cierre', 'inicio_afectacion',
  'fin_afectacion', 'ciudad', 'direccion', 'lat', 'lng', 'segmento', 'gestionado',
].join(', ')

// GET /api/casos?segmento=Silver
// Devuelve KPIs + filas de la vista casos_segmentados (ya excluye Cancelado).
// Sin ?segmento (o segmento=Todos) devuelve todo + el desglose por segmento.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const segmento = searchParams.get('segmento')
  const filtrar = !!segmento && segmento !== 'Todos'

  try {
    const sb = supabaseServer()

    // Filas del segmento (o todas), PAGINADAS en paralelo (sin esto solo
    // llegarían 1000; en serie, 27k filas podrían pasar el timeout).
    const rows = await traerFilas(sb, filtrar ? (segmento as string) : null)

    const kpis = {
      total:     rows.length,
      abiertos:  rows.filter((r: any) => r.abierto).length,
      cerrados:  rows.filter((r: any) => !r.abierto).length,
      ubicados:  rows.filter((r: any) => r.abierto && r.lat != null && r.lng != null).length,
    }

    // Desglose por segmento SIEMPRE sobre la distribución COMPLETA (conteos por
    // segmento con consultas 'head', livianas), no solo el filtrado, para que el
    // selector muestre bien aunque estés viendo un segmento.
    const porSegmento: Record<string, number> = {}
    const counts = await Promise.all(
      SEGMENTOS.map((s) =>
        sb.from('casos_segmentados').select('id', { count: 'exact', head: true }).eq('segmento', s),
      ),
    )
    SEGMENTOS.forEach((s, i) => { porSegmento[s] = counts[i].count ?? 0 })

    return NextResponse.json({ ok: true, segmento: segmento || 'Todos', kpis, porSegmento, rows })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

/** Trae todas las filas (opcionalmente de un segmento) paginando en paralelo. */
async function traerFilas(sb: SupabaseClient, segmento: string | null): Promise<any[]> {
  // Total para saber cuántas páginas pedir.
  let head = sb.from('casos_segmentados').select('id', { count: 'exact', head: true })
  if (segmento) head = head.eq('segmento', segmento)
  const { count, error: ce } = await head
  if (ce) throw ce
  const total = count ?? 0
  if (!total) return []

  const paginas = Math.ceil(total / PAG)
  const consultas = Array.from({ length: paginas }, (_, p) => {
    let q = sb.from('casos_segmentados').select(COLS).range(p * PAG, p * PAG + PAG - 1)
    if (segmento) q = q.eq('segmento', segmento)
    return q
  })
  const results = await Promise.all(consultas)
  const rows: any[] = []
  for (const { data, error } of results) { if (error) throw error; rows.push(...(data ?? [])) }
  return rows
}
