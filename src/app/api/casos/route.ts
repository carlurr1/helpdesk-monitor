import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { SEGMENTOS } from '@/lib/segmentos'
import { computeOperativo, computeEjecutivo, categoriaDe, edadDias, semaforo, type Categoria } from '@/lib/metrics'
import { geoDeCaso } from '@/lib/geo'
import type { Caso } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const PAG = 1000 // Supabase corta cada consulta en 1000 filas: hay que paginar.

// Columnas base que usa el cálculo. `direccion` se agrega solo si la columna
// existe (la app no debe romperse si no se corrió el ALTER).
const COLS_BASE = [
  'id', 'numero', 'nit', 'cuenta_nombre', 'cliente_base', 'estado', 'categoria',
  'tipologia', 'abierto', 'fecha_apertura', 'fecha_cierre', 'inicio_afectacion',
  'fin_afectacion', 'ciudad', 'lat', 'lng', 'segmento',
]

const SEGMENTOS_BOGOTA = ['Distrito', 'Élite']

// GET /api/casos?segmento=&cats=Incidente,Evento&estado=Abierto[&export=1]
// Calcula TODO en el servidor (KPIs, Operativo, Ejecutivo, puntos del mapa y
// tabla de abiertos) y devuelve JSON compacto — no manda 28k filas crudas.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const segmento = searchParams.get('segmento')
  const filtrar = !!segmento && segmento !== 'Todos'
  const cats = (searchParams.get('cats') || '').split(',').filter(Boolean) as Categoria[]
  const estado = searchParams.get('estado') || ''
  const esExport = searchParams.get('export') === '1'

  try {
    const sb = supabaseServer()
    const tieneDireccion = await columnaExiste(sb, 'direccion')
    const cols = tieneDireccion ? [...COLS_BASE, 'direccion'] : COLS_BASE

    let rows = await traerFilas(sb, filtrar ? (segmento as string) : null, cols.join(', '))
    if (!tieneDireccion) rows = rows.map((r) => ({ ...r, direccion: null }))

    // Filtros (categoría/estado) del lado servidor.
    const rowsFiltradas: Caso[] = rows.filter((r: Caso) => {
      if (cats.length && !cats.includes(categoriaDe(r))) return false
      if (estado && r.estado !== estado) return false
      return true
    })

    const now = new Date()

    // Export: devuelve solo los abiertos (campos mínimos) para el Excel.
    if (esExport) {
      const abiertos = rowsFiltradas.filter((r) => r.abierto).map((r) => filaTabla(r, now))
      return NextResponse.json({ ok: true, segmento: segmento || 'Todos', abiertos })
    }

    const kpis = {
      total:    rowsFiltradas.length,
      abiertos: rowsFiltradas.filter((r) => r.abierto).length,
      cerrados: rowsFiltradas.filter((r) => !r.abierto).length,
      ubicados: 0,
    }

    // Puntos del mapa: solo abiertos ubicados, agrupados por coordenada.
    const grupos = new Map<string, { lat: number; lng: number; ciudad: string; seg: string; count: number }>()
    for (const r of rowsFiltradas) {
      if (!r.abierto) continue
      let lat = r.lat, lng = r.lng
      if (lat == null || lng == null) { const g = geoDeCaso(r.ciudad, r.direccion); if (g) { lat = g.lat; lng = g.lng } }
      if (lat == null || lng == null) continue
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const g = grupos.get(key)
      if (g) g.count++
      else grupos.set(key, { lat, lng, ciudad: r.ciudad || 'Sin ciudad', seg: r.segmento, count: 1 })
    }
    const puntos = [...grupos.values()]
    kpis.ubicados = puntos.reduce((a, p) => a + p.count, 0)

    // Métricas Operativo / Ejecutivo (funciones puras, sobre lo filtrado).
    const op = computeOperativo(rowsFiltradas, now)
    const ej = computeEjecutivo(rowsFiltradas, now)

    // Tabla de abiertos (cap para no inflar el payload; el Excel usa ?export=1).
    const abiertosAll = rowsFiltradas.filter((r) => r.abierto)
    const abiertos = abiertosAll.slice(0, 500).map((r) => filaTabla(r, now))

    // Estados disponibles para el filtro (de todo el segmento, sin filtrar).
    const estados = [...new Set(rows.map((r: Caso) => r.estado).filter(Boolean))].sort()

    // Desglose por segmento SIEMPRE completo (conteos 'head', livianos).
    const porSegmento: Record<string, number> = {}
    const counts = await Promise.all(
      SEGMENTOS.map((s) => sb.from('casos_segmentados').select('id', { count: 'exact', head: true }).eq('segmento', s)),
    )
    SEGMENTOS.forEach((s, i) => { porSegmento[s] = counts[i].count ?? 0 })

    return NextResponse.json({
      ok: true,
      segmento: segmento || 'Todos',
      esBogota: filtrar && SEGMENTOS_BOGOTA.includes(segmento as string),
      updated: now.toISOString(),
      kpis, porSegmento, op, ej, puntos,
      abiertos, abiertosTotal: abiertosAll.length,
      estados,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

function filaTabla(r: Caso, now: Date) {
  const edad = edadDias(r, now)
  return {
    id: r.id, numero: r.numero,
    cliente: r.cuenta_nombre || r.cliente_base || r.nit || '—',
    estado: r.estado || '', categoria: categoriaDe(r), tipologia: r.tipologia || '',
    ciudad: r.ciudad || '', direccion: r.direccion || '',
    fecha_apertura: r.fecha_apertura, edad, sem: semaforo(edad),
  }
}

/** ¿Existe una columna en la vista? (para no romper si falta `direccion`). */
async function columnaExiste(sb: SupabaseClient, col: string): Promise<boolean> {
  const { error } = await sb.from('casos_segmentados').select(col).limit(1)
  return !error
}

/** Trae todas las filas (opcionalmente de un segmento) paginando en paralelo. */
async function traerFilas(sb: SupabaseClient, segmento: string | null, cols: string): Promise<any[]> {
  let head = sb.from('casos_segmentados').select('id', { count: 'exact', head: true })
  if (segmento) head = head.eq('segmento', segmento)
  const { count, error: ce } = await head
  if (ce) throw ce
  const total = count ?? 0
  if (!total) return []

  const paginas = Math.ceil(total / PAG)
  const consultas = Array.from({ length: paginas }, (_, p) => {
    let q = sb.from('casos_segmentados').select(cols).range(p * PAG, p * PAG + PAG - 1)
    if (segmento) q = q.eq('segmento', segmento)
    return q
  })
  const results = await Promise.all(consultas)
  const rows: any[] = []
  for (const { data, error } of results) { if (error) throw error; rows.push(...(data ?? [])) }
  return rows
}
