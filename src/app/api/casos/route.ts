import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { SEGMENTOS } from '@/lib/segmentos'
import { computeOperativo, computeEjecutivo, computeDistribuciones, categoriaDe, edadDias, semaforo, type Categoria } from '@/lib/metrics'
import { geoDeCaso } from '@/lib/geo'
import type { Caso } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAG = 1000 // Supabase corta cada consulta en 1000 filas: hay que paginar.
const CAP_TABLA = 5000 // techo de filas de abiertos que se mandan a la tabla (para que el buscador alcance cualquier caso).

// Columnas base que usa el cálculo. `direccion` se agrega solo si la columna
// existe (la app no debe romperse si no se corrió el ALTER).
const COLS_BASE = [
  'id', 'numero', 'nit', 'cuenta_nombre', 'cliente_base', 'estado', 'categoria',
  'tipologia', 'abierto', 'fecha_apertura', 'fecha_cierre', 'inicio_afectacion',
  'fin_afectacion', 'ciudad', 'lat', 'lng', 'segmento',
]

const SEGMENTOS_BOGOTA = ['Distrito', 'Élite']

// Cuentas a excluir del monitor (comparten NIT con la cuenta real). El token
// "ENTERATE" identifica a "ETB EnterateConETB".
function esExcluida(nombre: unknown): boolean {
  return /ENTERATE/i.test(String(nombre ?? ''))
}

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

  const cliente = searchParams.get('cliente') || ''

  try {
    const sb = supabaseServer()
    // Columnas opcionales que pueden no existir aún (según ALTER corridos).
    const OPCIONALES = ['direccion', 'proceso', 'origen', 'id_servicio', 'id_legado']
    const presentes = await Promise.all(OPCIONALES.map((c) => columnaExiste(sb, c)))
    const extra = OPCIONALES.filter((_, i) => presentes[i])
    const cols = [...COLS_BASE, ...extra]

    // Búsqueda directa de un caso: ignora segmento, filtros, tope y abierto/cerrado.
    // Sirve para hallar CUALQUIER caso por número (o parte), aunque esté cerrado o
    // en otro segmento. Devuelve pocas filas ya listas para la tabla.
    const buscar = (searchParams.get('buscar') || '').replace(/[%_,\s]/g, '')
    if (buscar) {
      const { data } = await sb.from('casos_segmentados').select(cols.join(', '))
        .ilike('numero', `%${buscar}%`).limit(50)
      const now = new Date()
      const resultados = (data ?? [])
        .filter((r: any) => !esExcluida(r.cuenta_nombre))
        .map((r: any) => ({ ...filaTabla(r as Caso, now), abierto: r.abierto === true }))
      return NextResponse.json({ ok: true, buscar, resultados })
    }

    let rows = await traerFilas(sb, filtrar ? (segmento as string) : null, cols.join(', '))
    // Rellena con null las columnas que no existen para una forma uniforme.
    const faltantes = OPCIONALES.filter((c) => !extra.includes(c))
    if (faltantes.length) rows = rows.map((r) => { const o: any = { ...r }; faltantes.forEach((c) => { if (o[c] === undefined) o[c] = null }); return o })

    // Cuentas excluidas del monitor (comparten NIT con la cuenta real).
    // "ETB EnterateConETB" no debe contar como ETB.
    rows = rows.filter((r: any) => !esExcluida(r.cuenta_nombre))

    // Filtros (categoría/estado/cliente) del lado servidor. El fallback debe
    // coincidir con el de computeOperativo ('Sin cliente') para que al hacer
    // click en "Sin cliente" en el top-clientes el filtro sí encuentre esos casos.
    const clienteNombre = (r: Caso) => r.cuenta_nombre || r.cliente_base || r.nit || 'Sin cliente'
    const rowsFiltradas: Caso[] = rows.filter((r: Caso) => {
      if (cats.length && !cats.includes(categoriaDe(r))) return false
      if (estado && r.estado !== estado) return false
      if (cliente && clienteNombre(r) !== cliente) return false
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

    // Métricas Operativo / Ejecutivo / distribuciones (funciones puras).
    const op = computeOperativo(rowsFiltradas, now)
    const ej = computeEjecutivo(rowsFiltradas, now)
    const dist = computeDistribuciones(rowsFiltradas)

    // Tabla de abiertos. Se mandan TODOS los abiertos (con un techo alto de
    // seguridad) para que el buscador de la tabla encuentre cualquier caso; la UI
    // limita cuántas filas pinta a la vez. El Excel completo usa ?export=1.
    const abiertosAll = rowsFiltradas.filter((r) => r.abierto)
    const abiertos = abiertosAll.slice(0, CAP_TABLA).map((r) => filaTabla(r, now))

    // Estados y clientes disponibles (del segmento completo, sin filtrar por cats/estado/cliente).
    const estados = [...new Set(rows.map((r: Caso) => r.estado).filter(Boolean))].sort()
    const clientes = [...new Set(rows.map(clienteNombre).filter(Boolean))].sort().slice(0, 400)

    // Desglose por segmento = casos ABIERTOS por segmento (coincide con el KPI
    // "Casos abiertos"). Se talla: si es "Todos", desde las ya traídas; si es un
    // segmento, con un barrido liviano de `segmento, abierto`.
    const porSegmento: Record<string, number> = {}
    const filasParaTally = filtrar ? await fetchSecuencial(sb, 'id, segmento, abierto, cuenta_nombre', null) : rows
    const tally: Record<string, number> = {}
    for (const r of filasParaTally as any[]) {
      if (!r.abierto || esExcluida(r.cuenta_nombre)) continue
      const s = String(r.segmento ?? '').normalize('NFC')
      tally[s] = (tally[s] || 0) + 1
    }
    for (const s of SEGMENTOS) porSegmento[s] = tally[s.normalize('NFC')] || 0

    // Última sincronización con Salesforce (para distinguir de la relectura).
    const { data: syncRow } = await sb.from('casos').select('sincronizado_en').order('sincronizado_en', { ascending: false }).limit(1)
    const sincronizado = (syncRow && syncRow[0]?.sincronizado_en) || null

    return NextResponse.json({
      ok: true,
      segmento: segmento || 'Todos',
      esBogota: filtrar && SEGMENTOS_BOGOTA.includes(segmento as string),
      updated: now.toISOString(),
      kpis, porSegmento, op, ej, puntos, dist,
      abiertos, abiertosTotal: abiertosAll.length,
      estados, clientes, cliente, sincronizado,
      _debug: {
        ver: 'seq-v6',
        colsPresentes: extra,
        muestraExtra: rows[0] ? { proceso: rows[0].proceso, origen: rows[0].origen, direccion: rows[0].direccion, id_servicio: rows[0].id_servicio, id_legado: rows[0].id_legado } : null,
        rowsTraidas: rows.length,
        idsUnicos: new Set(rows.map((r: any) => r.id)).size,
        segTally: rows.reduce((m: any, r: any) => { const s = r.segmento || '∅'; m[s] = (m[s] || 0) + 1; return m }, {} as Record<string, number>),
        rowsFiltradas: rowsFiltradas.length,
        casosAbiertos: abiertosAll.length,
        clientesAbiertos: op.kpis.clientesAbiertos,
        clientesDistintos: new Set(abiertosAll.map((r) => r.cuenta_nombre || r.cliente_base || r.nit || '?')).size,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

function filaTabla(r: Caso, now: Date) {
  const edad = edadDias(r, now)
  return {
    id: r.id, numero: r.numero,
    cliente: r.cuenta_nombre || r.cliente_base || r.nit || 'Sin cliente',
    segmento: r.segmento || 'Sin clasificar',
    estado: r.estado || '', categoria: categoriaDe(r), tipologia: r.tipologia || '',
    proceso: r.proceso || '', origen: r.origen || '',
    ciudad: r.ciudad || '', direccion: r.direccion || '',
    id_servicio: r.id_servicio || '', id_legado: r.id_legado || '',
    fecha_apertura: r.fecha_apertura, edad, sem: semaforo(edad),
  }
}

/** ¿Existe una columna en la vista? (para no romper si falta `direccion`). */
async function columnaExiste(sb: SupabaseClient, col: string): Promise<boolean> {
  const { error } = await sb.from('casos_segmentados').select(col).limit(1)
  return !error
}

/**
 * Fetch por KEYSET (no por offset). La paginación con .range() sobre `id` de texto
 * puede SALTARSE filas cuando la colación del `id` no impone un orden total estricto
 * (dos ids distintos "empatan" en la colación), y así se perdían casos aunque
 * existieran en la vista (p. ej. un abierto que no salía en su segmento). Aquí se
 * avanza con `id >= último` y se deduplica por id: nunca se salta una fila.
 * El filtro .eq va ANTES de order()/limit() (aplicarlo después lo rompe con acentos).
 * NOTA: `cols` debe incluir `id` (lo necesita el keyset).
 */
async function fetchSecuencial(sb: SupabaseClient, cols: string, segmento: string | null): Promise<any[]> {
  const rows: any[] = []
  const vistos = new Set<string>()
  let ultimo: string | null = null
  for (;;) {
    let sel = segmento
      ? sb.from('casos_segmentados').select(cols).eq('segmento', segmento)
      : sb.from('casos_segmentados').select(cols)
    // >= (no >) para no saltarse filas cuya `id` empate en la colación con `ultimo`;
    // la deduplicación por id quita el solape del borde.
    if (ultimo !== null) sel = sel.gte('id', ultimo)
    const { data, error } = await sel.order('id', { ascending: true }).limit(PAG)
    if (error) throw error
    const lote = data ?? []
    const nuevos = lote.filter((r: any) => !vistos.has(r.id))
    for (const r of nuevos as any[]) vistos.add(r.id)
    rows.push(...nuevos)
    if (lote.length < PAG) break
    const sig = (lote[lote.length - 1] as any).id as string
    // Protección anti-bucle: si una página llena no aporta filas nuevas y el borde
    // no avanza, cortamos (no debería pasar con ids únicos de Salesforce).
    if (!nuevos.length && sig === ultimo) break
    ultimo = sig
  }
  return rows
}

/** Trae todas las filas (opcionalmente de un segmento). */
async function traerFilas(sb: SupabaseClient, segmento: string | null, cols: string): Promise<any[]> {
  const rows = await fetchSecuencial(sb, cols, segmento)
  if (!segmento) return rows
  // Red de seguridad: normaliza acentos (NFC) por si la URL y la BD difieren.
  const objetivo = segmento.normalize('NFC')
  return rows.filter((r) => String(r.segmento ?? '').normalize('NFC') === objetivo)
}
