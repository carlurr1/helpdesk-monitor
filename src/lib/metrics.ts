// ============================================================
//  Métricas del tablero — funciones puras sobre Caso[]
//  Todo se computa en el cliente a partir de las filas que ya devuelve la API,
//  replicando el tablero de Apps Script (Operativo / Ejecutivo).
// ============================================================
import type { Caso } from './types'

export type Categoria = 'Incidente' | 'Evento' | 'Requerimiento' | 'Otros'

export const CAT_COLOR: Record<Categoria, string> = {
  Incidente:     '#ea6b5d',
  Evento:        '#f79009',
  Requerimiento: '#0b5aa5',
  Otros:         '#b0c0d0',
}

export type Semaforo = 'critical' | 'warning' | 'healthy'

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  critical: 'Crítico',
  warning:  'Atención',
  healthy:  'Al día',
}

function norm(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Clasifica un caso en Incidente / Evento / Requerimiento a partir de categoría/tipología. */
export function categoriaDe(c: Caso): Categoria {
  const t = norm(c.categoria) + ' ' + norm(c.tipologia)
  if (t.includes('INCIDENTE')) return 'Incidente'
  if (t.includes('EVENTO')) return 'Evento'
  if (t.includes('REQUERIMIENTO') || t.includes('SOLICITUD') || t.includes('PETICION')) return 'Requerimiento'
  return 'Otros'
}

export const CATEGORIAS: Categoria[] = ['Incidente', 'Evento', 'Requerimiento']

const DIA_MS = 24 * 60 * 60 * 1000

/** Antigüedad en días (redondeada a 1 decimal) desde la apertura. */
export function edadDias(c: Caso, now: Date = new Date()): number {
  if (!c.fecha_apertura) return 0
  const ms = now.getTime() - new Date(c.fecha_apertura).getTime()
  return Math.max(0, Math.round((ms / DIA_MS) * 10) / 10)
}

/** Semáforo por antigüedad: crítico ≥8 días, atención 5–7, al día <5. */
export function semaforo(edad: number): Semaforo {
  if (edad >= 8) return 'critical'
  if (edad >= 5) return 'warning'
  return 'healthy'
}

/** TMS (tiempo de solución) en horas: fin − inicio de afectación. null si falta algún extremo. */
export function tmsHoras(c: Caso): number | null {
  if (!c.inicio_afectacion || !c.fin_afectacion) return null
  const h = (new Date(c.fin_afectacion).getTime() - new Date(c.inicio_afectacion).getTime()) / (60 * 60 * 1000)
  return h > 0 ? Math.round(h * 10) / 10 : null
}

function keyDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function mismoMes(d: Date, ref: Date): boolean {
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

// ── Distribución tricolor por categoría (para barras apiladas) ──
export interface Tricolor {
  label: string
  total: number
  Incidente: number
  Evento: number
  Requerimiento: number
  Otros: number
}

function acumular(map: Map<string, Tricolor>, label: string, cat: Categoria) {
  let t = map.get(label)
  if (!t) { t = { label, total: 0, Incidente: 0, Evento: 0, Requerimiento: 0, Otros: 0 }; map.set(label, t) }
  t.total++
  t[cat]++
}

// ── KPIs Operativos ──
export interface KpisOperativo {
  abiertos: number
  ingresosMes: number
  cierresMes: number
  antiguedadProm: number
  pctCriticos: number
  pctAtencion: number
  clientesAbiertos: number
  ingresosDiaProm: number
  cierresDiaProm: number
  ingresosHoy: number
  cierresHoy: number
}

export interface TendenciaPunto { dia: string; ingresos: number; cierres: number; abiertos: number }
export interface AgingBuckets { '0-2': number; '3-4': number; '5-7': number; '8-14': number; '15+': number }

export interface Operativo {
  kpis: KpisOperativo
  estados: Tricolor[]
  topAbiertos: Tricolor[]
  topCriticos: Tricolor[]
  tendencia: TendenciaPunto[]
  aging: AgingBuckets
  semaforos: { critical: number; warning: number; healthy: number }
}

function agingVacio(): AgingBuckets { return { '0-2': 0, '3-4': 0, '5-7': 0, '8-14': 0, '15+': 0 } }
function sumaAging(b: AgingBuckets, edad: number) {
  if (edad <= 2) b['0-2']++
  else if (edad <= 4) b['3-4']++
  else if (edad <= 7) b['5-7']++
  else if (edad <= 14) b['8-14']++
  else b['15+']++
}

export function computeOperativo(rows: Caso[], now: Date = new Date(), dias = 14): Operativo {
  const abiertosRows = rows.filter((r) => r.abierto)
  const hoyKey = keyDia(now)

  // Tendencia últimos N días
  const idx = new Map<string, number>()
  const tendencia: TendenciaPunto[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DIA_MS)
    const k = keyDia(d)
    idx.set(k, tendencia.length)
    tendencia.push({ dia: k.slice(5), ingresos: 0, cierres: 0, abiertos: 0 })
  }
  let ingresosMes = 0, cierresMes = 0, ingresosHoy = 0, cierresHoy = 0
  const diasIngreso = new Set<string>(), diasCierre = new Set<string>()

  for (const r of rows) {
    if (r.fecha_apertura) {
      const d = new Date(r.fecha_apertura); const k = keyDia(d)
      if (mismoMes(d, now)) ingresosMes++
      if (k === hoyKey) ingresosHoy++
      diasIngreso.add(k)
      const i = idx.get(k); if (i != null) tendencia[i].ingresos++
    }
    if (r.fecha_cierre) {
      const d = new Date(r.fecha_cierre); const k = keyDia(d)
      if (mismoMes(d, now)) cierresMes++
      if (k === hoyKey) cierresHoy++
      diasCierre.add(k)
      const i = idx.get(k); if (i != null) tendencia[i].cierres++
    }
  }
  // Abiertos acumulados en la serie = abiertos hoy (aprox. visual)
  for (const p of tendencia) p.abiertos = abiertosRows.length

  // Semáforos + aging sobre abiertos
  const aging = agingVacio()
  let critical = 0, warning = 0, healthy = 0, sumaEdad = 0
  const estadosMap = new Map<string, Tricolor>()
  const clientesMap = new Map<string, Tricolor>()
  const criticosMap = new Map<string, Tricolor>()

  for (const r of abiertosRows) {
    const edad = edadDias(r, now)
    sumaEdad += edad
    sumaAging(aging, edad)
    const s = semaforo(edad)
    if (s === 'critical') critical++; else if (s === 'warning') warning++; else healthy++
    const cat = categoriaDe(r)
    acumular(estadosMap, r.estado || 'Sin estado', cat)
    acumular(clientesMap, r.cuenta_nombre || r.cliente_base || r.nit || 'Sin cliente', cat)
    if (s === 'critical') acumular(criticosMap, r.cuenta_nombre || r.cliente_base || r.nit || 'Sin cliente', cat)
  }

  const n = abiertosRows.length || 1
  const topN = (m: Map<string, Tricolor>, k = 8) =>
    [...m.values()].sort((a, b) => b.total - a.total).slice(0, k)

  const kpis: KpisOperativo = {
    abiertos: abiertosRows.length,
    ingresosMes,
    cierresMes,
    antiguedadProm: Math.round((sumaEdad / n) * 10) / 10,
    pctCriticos: Math.round((critical / n) * 1000) / 10,
    pctAtencion: Math.round((warning / n) * 1000) / 10,
    clientesAbiertos: clientesMap.size,
    ingresosDiaProm: Math.round((rows.filter((r) => r.fecha_apertura).length / (diasIngreso.size || 1)) * 10) / 10,
    cierresDiaProm: Math.round((rows.filter((r) => r.fecha_cierre).length / (diasCierre.size || 1)) * 10) / 10,
    ingresosHoy,
    cierresHoy,
  }

  return {
    kpis,
    estados: topN(estadosMap),
    topAbiertos: topN(clientesMap),
    topCriticos: topN(criticosMap),
    tendencia,
    aging,
    semaforos: { critical, warning, healthy },
  }
}

// ── KPIs / series Ejecutivo ──
export interface KpisEjecutivo {
  pendientes: number
  ingresos7: number
  cierres7: number
  ingresosDiaProm: number
  cierresDiaProm: number
  pctCriticos: number
}
export interface TmsPunto { dia: string; tms: number }
export interface Ejecutivo {
  kpis: KpisEjecutivo
  tendencia: TendenciaPunto[]
  tms: TmsPunto[]
  top10: Tricolor[]
  top5: { label: string; total: number }[]
  aging: AgingBuckets
}

export function computeEjecutivo(rows: Caso[], now: Date = new Date()): Ejecutivo {
  const op = computeOperativo(rows, now, 14)
  const hace7 = new Date(now.getTime() - 7 * DIA_MS)
  const ingresos7 = rows.filter((r) => r.fecha_apertura && new Date(r.fecha_apertura) >= hace7).length
  const cierres7 = rows.filter((r) => r.fecha_cierre && new Date(r.fecha_cierre) >= hace7).length

  // TMS diario promedio (14 días) usando cierres con afectación
  const tms: TmsPunto[] = []
  const tmap = new Map<string, { s: number; n: number }>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DIA_MS)
    tmap.set(keyDia(d), { s: 0, n: 0 })
    tms.push({ dia: keyDia(d).slice(5), tms: 0 })
  }
  const orden = [...tmap.keys()]
  for (const r of rows) {
    const h = tmsHoras(r)
    if (h == null || !r.fecha_cierre) continue
    const k = keyDia(new Date(r.fecha_cierre))
    const acc = tmap.get(k)
    if (acc) { acc.s += h; acc.n++ }
  }
  orden.forEach((k, i) => { const a = tmap.get(k)!; tms[i].tms = a.n ? Math.round((a.s / a.n) * 10) / 10 : 0 })

  // Top 5 por ingresos últimos 7 días
  const t5 = new Map<string, number>()
  for (const r of rows) {
    if (!r.fecha_apertura || new Date(r.fecha_apertura) < hace7) continue
    const c = r.cuenta_nombre || r.cliente_base || r.nit || 'Sin cliente'
    t5.set(c, (t5.get(c) || 0) + 1)
  }
  const top5 = [...t5.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, total]) => ({ label, total }))

  return {
    kpis: {
      pendientes: op.kpis.abiertos,
      ingresos7, cierres7,
      ingresosDiaProm: Math.round((ingresos7 / 7) * 10) / 10,
      cierresDiaProm: Math.round((cierres7 / 7) * 10) / 10,
      pctCriticos: op.kpis.pctCriticos,
    },
    tendencia: op.tendencia,
    tms,
    top10: op.topAbiertos.slice(0, 10),
    top5,
    aging: op.aging,
  }
}
