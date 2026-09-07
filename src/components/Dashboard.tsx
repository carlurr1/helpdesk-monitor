'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Sidebar } from './shell/Sidebar'
import { Topbar } from './shell/Topbar'
import { KpiTile } from './dash/KpiTile'
import { TricolorBars } from './dash/TricolorBars'
import { TendenciaChart, TmsChart, AgingChart, DonutCategoria, BarList } from './dash/Charts'
import { CasosTablaSemaforo } from './dash/CasosTablaSemaforo'
import { Filtros } from './dash/Filtros'
import { ExportExcel } from './dash/ExportExcel'
import type { Categoria } from '@/lib/metrics'
import type { ApiCasos } from '@/lib/types'

const MapaCasos = dynamic(() => import('./MapaCasos'), {
  ssr: false,
  loading: () => <div className="card grid h-[520px] place-items-center text-sm text-[var(--muted)]">Cargando mapa…</div>,
})

const REFRESH_MS = 60000
type Tab = 'operacion' | 'ejecutivo'

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

export default function Dashboard() {
  const [segmento, setSegmento] = useState('Todos')
  const [tab, setTab] = useState<Tab>('operacion')
  const [cats, setCats] = useState<Categoria[]>([])
  const [estado, setEstado] = useState('')
  const [cliente, setCliente] = useState('')
  const [data, setData] = useState<ApiCasos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const cargar = useCallback((seg: string, cs: Categoria[], est: string, cli: string, silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ segmento: seg })
    if (cs.length) qs.set('cats', cs.join(','))
    if (est) qs.set('estado', est)
    if (cli) qs.set('cliente', cli)
    return fetch(`/api/casos?${qs.toString()}`)
      .then((r) => r.json())
      .then((j: ApiCasos) => { if (j.ok) { setData(j); setUpdated(new Date()) } else setError(j.error || 'Error desconocido') })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar(segmento, cats, estado, cliente) }, [segmento, cats, estado, cliente, cargar])
  useEffect(() => {
    const id = setInterval(() => cargar(segmento, cats, estado, cliente, true), REFRESH_MS)
    return () => clearInterval(id)
  }, [segmento, cats, estado, cliente, cargar])

  const op = data?.op
  const ej = data?.ej
  const dist = data?.dist

  const cambiarSegmento = (s: string) => { setCliente(''); setSegmento(s); setNavOpen(false) }
  const filtrarCliente = (c: string) => { setCliente(c); scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
  const toggleCat = (c: Categoria) => setCats((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])
  const reset = () => { setCats([]); setEstado(''); setCliente('') }
  const logout = () => { try { localStorage.removeItem('etb_monitor_auth') } catch {}; location.reload() }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: fijo en desktop, off-canvas en móvil */}
      {navOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} />}
      <div className={'fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:z-auto ' + (navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <Sidebar tab={tab} onTab={(t) => { setTab(t); setNavOpen(false) }} segmento={segmento} onSegmento={cambiarSegmento} counts={data?.porSegmento} onLogout={logout} />
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto">
        <Topbar
          segmento={segmento} tab={tab} updated={updated} cliente={cliente}
          onClearCliente={() => setCliente('')} onRefresh={() => cargar(segmento, cats, estado, cliente)}
          onMenu={() => setNavOpen(true)}
          right={<ExportExcel segmento={segmento} cats={cats} estado={estado} cliente={cliente} />}
        />

        <div className="space-y-4 p-6">
          <Filtros
            cats={cats} onToggleCat={toggleCat} estados={data?.estados ?? []} estado={estado} onEstado={setEstado}
            clientes={data?.clientes ?? []} cliente={cliente} onCliente={setCliente} onReset={reset}
          />

          {error && <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No se pudieron cargar los casos: {error}.</div>}
          {loading && !data && <p className="text-sm text-[var(--muted)]">Cargando…</p>}

          {data && op && tab === 'operacion' && (
            <Section>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <KpiTile label="Casos abiertos" value={op.kpis.abiertos} tone="accent" meta="Total del segmento" />
                <KpiTile label="Críticos" value={`${op.kpis.pctCriticos}%`} tone="danger" meta={`${op.semaforos.critical} casos ≥ 8 d`} />
                <KpiTile label="En atención" value={`${op.kpis.pctAtencion}%`} tone="warning" meta={`${op.semaforos.warning} casos 5–7 d`} />
                <KpiTile label="Antigüedad prom." value={`${op.kpis.antiguedadProm} d`} meta="Promedio de abiertos" />
                <KpiTile label="Clientes abiertos" value={op.kpis.clientesAbiertos} tone="success" meta="Con casos abiertos" />
                <KpiTile label="Ubicados en mapa" value={data.kpis.ubicados} meta="Abiertos geolocalizados" />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
                <TendenciaChart data={op.tendencia} />
                <div className="grid gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <KpiTile label="Ingresos mes" value={op.kpis.ingresosMes} tone="warning" meta={`Hoy ${op.kpis.ingresosHoy}`} />
                    <KpiTile label="Cierres mes" value={op.kpis.cierresMes} tone="success" meta={`Hoy ${op.kpis.cierresHoy}`} />
                    <KpiTile label="Total abiertos" value={op.kpis.abiertos} tone="accent" />
                  </div>
                  {dist && <DonutCategoria data={dist.categoria} />}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TricolorBars title="Top clientes abiertos" subtitle="Clientes con más casos abiertos" items={op.topAbiertos} rank onCliente={filtrarCliente} />
                <TricolorBars title="Top clientes críticos" subtitle="Con casos de más de 8 días" items={op.topCriticos} rank onCliente={filtrarCliente} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
                <MapaCasos puntos={data.puntos ?? []} segmento={segmento} esBogota={data.esBogota} />
                <AgingChart aging={op.aging} />
              </div>

              {dist && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <BarList title="Por origen" subtitle="Casos abiertos" data={dist.origen} color="#0b5aa5" />
                  <BarList title="Por proceso" subtitle="Casos abiertos" data={dist.proceso} color="#12b7b0" />
                  <BarList title="Top ciudades" subtitle="Casos abiertos" data={dist.ciudades} color="#7c5cff" />
                </div>
              )}

              <CasosTablaSemaforo abiertos={data.abiertos ?? []} total={data.abiertosTotal ?? 0} onCliente={filtrarCliente} />
            </Section>
          )}

          {data && ej && tab === 'ejecutivo' && (
            <Section>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <KpiTile label="Casos abiertos" value={ej.kpis.pendientes} tone="accent" />
                <KpiTile label="Ingresos 7 días" value={ej.kpis.ingresos7} tone="warning" meta={`${ej.kpis.ingresosDiaProm}/día`} />
                <KpiTile label="Cierres 7 días" value={ej.kpis.cierres7} tone="success" meta={`${ej.kpis.cierresDiaProm}/día`} />
                <KpiTile label="Críticos" value={`${ej.kpis.pctCriticos}%`} tone="danger" meta="≥ 8 días" />
                <KpiTile label="Ubicados" value={data.kpis.ubicados} meta="En mapa" />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
                <TendenciaChart data={ej.tendencia} showAbiertos={false} title="Tendencia 14 días" subtitle="Ingresos y cierres diarios" />
                <TricolorBars title="Top 10 clientes" subtitle="Casos abiertos por cliente" items={ej.top10} rank onCliente={filtrarCliente} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TmsChart data={ej.tms} />
                {dist && <DonutCategoria data={dist.categoria} />}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
                <MapaCasos puntos={data.puntos ?? []} segmento={segmento} esBogota={data.esBogota} />
                <AgingChart aging={ej.aging} />
              </div>

              {dist && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <BarList title="Por origen" data={dist.origen} color="#0b5aa5" />
                  <BarList title="Por proceso" data={dist.proceso} color="#12b7b0" />
                  <BarList title="Por estado" data={dist.estados} color="#dc6803" />
                </div>
              )}

              <CasosTablaSemaforo abiertos={data.abiertos ?? []} total={data.abiertosTotal ?? 0} onCliente={filtrarCliente} />
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
