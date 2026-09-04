'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { SegmentSelector } from './SegmentSelector'
import { KpiTile } from './dash/KpiTile'
import { TricolorBars, LeyendaCategorias } from './dash/TricolorBars'
import { TendenciaChart, TmsChart, AgingChart } from './dash/Charts'
import { CasosTablaSemaforo } from './dash/CasosTablaSemaforo'
import { Filtros } from './dash/Filtros'
import { ExportExcel } from './dash/ExportExcel'
import { computeOperativo, computeEjecutivo, categoriaDe, type Categoria } from '@/lib/metrics'
import { geoDeCaso } from '@/lib/geo'
import { ETB } from '@/lib/colors'
import type { ApiCasos, Caso } from '@/lib/types'

const MapaCasos = dynamic(() => import('./MapaCasos'), {
  ssr: false,
  loading: () => <div className="grid h-[440px] place-items-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">Cargando mapa…</div>,
})

const REFRESH_MS = 60000
type Tab = 'operacion' | 'ejecutivo'

export default function Dashboard() {
  const [segmento, setSegmento] = useState('Todos')
  const [tab, setTab] = useState<Tab>('operacion')
  const [cats, setCats] = useState<Categoria[]>([])
  const [estado, setEstado] = useState('')
  const [data, setData] = useState<ApiCasos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)

  const cargar = useCallback((seg: string, silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError(null)
    return fetch(`/api/casos?segmento=${encodeURIComponent(seg)}`)
      .then((r) => r.json())
      .then((j: ApiCasos) => { if (j.ok) { setData(j); setUpdated(new Date()) } else setError(j.error || 'Error desconocido') })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar(segmento) }, [segmento, cargar])
  useEffect(() => { const id = setInterval(() => cargar(segmento, true), REFRESH_MS); return () => clearInterval(id) }, [segmento, cargar])

  const now = useMemo(() => new Date(), [updated])
  const rows: Caso[] = data?.rows ?? []
  const estadosOpts = useMemo(() => [...new Set(rows.map((r) => r.estado).filter(Boolean) as string[])].sort(), [rows])

  const rowsFiltradas = useMemo(() => rows.filter((r) => {
    if (cats.length && !cats.includes(categoriaDe(r))) return false
    if (estado && r.estado !== estado) return false
    return true
  }), [rows, cats, estado])

  const ubicados = useMemo(
    () => rowsFiltradas.filter((r) => r.abierto && ((r.lat != null && r.lng != null) || geoDeCaso(r.ciudad, r.direccion))).length,
    [rowsFiltradas],
  )
  const op = useMemo(() => computeOperativo(rowsFiltradas, now), [rowsFiltradas, now])
  const ej = useMemo(() => computeEjecutivo(rowsFiltradas, now), [rowsFiltradas, now])

  const toggleCat = (c: Categoria) => setCats((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])
  const reset = () => { setCats([]); setEstado('') }

  return (
    <div className="space-y-4">
      {/* Topbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Monitor Help Desk · ETB</h1>
          <p className="text-xs text-slate-400">{updated ? `Actualizado ${updated.toLocaleTimeString('es-CO')}` : 'Cargando…'}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcel rows={rowsFiltradas} now={now} segmento={segmento} />
          <button onClick={() => cargar(segmento)} title="Actualizar ahora"
            className="rounded-full bg-gradient-to-br from-brand to-sky-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm">Refrescar</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([['operacion', 'Operativo'], ['ejecutivo', 'Ejecutivo']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={'rounded-full border px-4 py-1.5 text-sm font-extrabold ' + (tab === k ? 'border-brand/20 bg-brand/10 text-brand' : 'border-slate-200 bg-white text-slate-600 hover:border-brand')}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SegmentSelector value={segmento} onChange={setSegmento} counts={data?.porSegmento} />
      </div>
      <Filtros cats={cats} onToggleCat={toggleCat} estados={estadosOpts} estado={estado} onEstado={setEstado} onReset={reset} />

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No se pudieron cargar los casos: {error}.</div>}
      {loading && !data && <p className="text-sm text-slate-400">Cargando…</p>}

      {data && tab === 'operacion' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Casos abiertos" value={op.kpis.abiertos} accent={ETB.blue} meta="Total abiertos" />
            <KpiTile label="Ingresos mes" value={op.kpis.ingresosMes} accent={ETB.yellow} meta={`Hoy: ${op.kpis.ingresosHoy}`} />
            <KpiTile label="Cierres mes" value={op.kpis.cierresMes} accent={ETB.teal} meta={`Hoy: ${op.kpis.cierresHoy}`} />
            <KpiTile label="Antigüedad prom." value={`${op.kpis.antiguedadProm} d`} accent={ETB.coral} meta="Promedio de abiertos" />
            <KpiTile label="Críticos" value={`${op.kpis.pctCriticos}%`} accent={ETB.coral} meta="≥ 8 días" />
            <KpiTile label="Atención" value={`${op.kpis.pctAtencion}%`} accent={ETB.yellow} meta="5–7 días" />
            <KpiTile label="Clientes abiertos" value={op.kpis.clientesAbiertos} accent={ETB.green} meta="Con casos abiertos" />
            <KpiTile label="Prom. ingresos/día" value={op.kpis.ingresosDiaProm} accent={ETB.blue} />
            <KpiTile label="Prom. cierres/día" value={op.kpis.cierresDiaProm} accent={ETB.teal} />
            <KpiTile label="Ingresos hoy" value={op.kpis.ingresosHoy} accent={ETB.yellow} />
            <KpiTile label="Cierres hoy" value={op.kpis.cierresHoy} accent={ETB.green} />
            <KpiTile label="Ubicados en mapa" value={ubicados} accent={ETB.blue} meta="Con ubicación" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <TendenciaChart data={op.tendencia} />
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <KpiTile label="Críticos" value={op.semaforos.critical} accent={ETB.coral} />
                <KpiTile label="Atención" value={op.semaforos.warning} accent={ETB.yellow} />
                <KpiTile label="Al día" value={op.semaforos.healthy} accent={ETB.green} />
                <KpiTile label="Total" value={op.kpis.abiertos} accent={ETB.blue} />
              </div>
              <TricolorBars title="Estados top" subtitle="Casos por estado (por categoría)" items={op.estados} />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TricolorBars title="Top clientes abiertos" subtitle="Clientes con más casos abiertos" items={op.topAbiertos} rank />
            <TricolorBars title="Top clientes críticos" subtitle="Clientes con casos de más de 8 días" items={op.topCriticos} rank />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MapaCasos rows={rowsFiltradas} segmento={segmento} />
            <AgingChart aging={op.aging} />
          </div>

          <CasosTablaSemaforo rows={rowsFiltradas} now={now} />
        </>
      )}

      {data && tab === 'ejecutivo' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiTile label="Casos abiertos" value={ej.kpis.pendientes} accent={ETB.blue} />
            <KpiTile label="Ingresos (7 días)" value={ej.kpis.ingresos7} accent={ETB.yellow} meta="Últimos 7 días" />
            <KpiTile label="Cierres (7 días)" value={ej.kpis.cierres7} accent={ETB.teal} meta="Últimos 7 días" />
            <KpiTile label="Ingresos/día" value={ej.kpis.ingresosDiaProm} accent={ETB.yellow} meta="Promedio 7 días" />
            <KpiTile label="Cierres/día" value={ej.kpis.cierresDiaProm} accent={ETB.green} meta="Promedio 7 días" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <TendenciaChart data={ej.tendencia} showAbiertos={false} title="Tendencia últimos 14 días" subtitle="Ingresos y cierres diarios" />
            <div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="mb-1 text-[13px] font-extrabold uppercase tracking-wide text-brand">Top 10 clientes</h3>
                <p className="mb-2 text-xs text-slate-400">Casos abiertos por cliente</p>
                <LeyendaCategorias />
              </div>
              <div className="mt-2"><TricolorBars title="" items={ej.top10} rank /></div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TmsChart data={ej.tms} />
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-brand">Top 5 clientes (últimos 7 días)</h3>
                <p className="mt-0.5 text-xs text-slate-400">Clientes con mayores ingresos</p>
              </div>
              <div className="space-y-2 p-3">
                {!ej.top5.length && <p className="py-6 text-center text-sm text-slate-400">Sin ingresos en los últimos 7 días</p>}
                {ej.top5.map((c, i) => (
                  <div key={c.label} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-700">{i + 1}</span>
                    <span className="flex-1 truncate text-sm font-semibold text-slate-700">{c.label}</span>
                    <span className="text-sm font-extrabold text-emerald-700">{c.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MapaCasos rows={rowsFiltradas} segmento={segmento} />
            <AgingChart aging={ej.aging} />
          </div>
        </>
      )}
    </div>
  )
}
