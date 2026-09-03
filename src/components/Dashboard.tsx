'use client'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { SegmentSelector } from './SegmentSelector'
import { KpiCard } from './ui/KpiCard'
import { CasosPorSegmento } from './CasosPorSegmento'
import { AbiertosCerrados } from './AbiertosCerrados'
import { IngresosPorDia } from './IngresosPorDia'
import { CasosTable } from './CasosTable'
import type { ApiCasos } from '@/lib/types'

// El mapa (Leaflet) solo corre en el navegador.
const MapaCasos = dynamic(() => import('./MapaCasos'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[490px] place-items-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
      Cargando mapa…
    </div>
  ),
})

const REFRESH_MS = 60000 // auto-refresco cada 60 s (lee la cache de Supabase)

export default function Dashboard() {
  const [segmento, setSegmento] = useState('Todos')
  const [data, setData] = useState<ApiCasos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)

  const cargar = useCallback((seg: string, silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError(null)
    return fetch(`/api/casos?segmento=${encodeURIComponent(seg)}`)
      .then((r) => r.json())
      .then((j: ApiCasos) => {
        if (j.ok) { setData(j); setUpdated(new Date()) }
        else setError(j.error || 'Error desconocido')
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar(segmento) }, [segmento, cargar])
  useEffect(() => {
    const id = setInterval(() => cargar(segmento, true), REFRESH_MS)
    return () => clearInterval(id)
  }, [segmento, cargar])

  const k = data?.kpis
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentSelector value={segmento} onChange={setSegmento} counts={data?.porSegmento} />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {updated && <span>Actualizado {updated.toLocaleTimeString('es-CO')}</span>}
          <button
            onClick={() => cargar(segmento)}
            title="Actualizar ahora"
            className="rounded-lg border border-slate-200 px-2 py-1 hover:border-brand hover:text-brand"
          >↻</button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudieron cargar los casos: {error}.
        </div>
      )}

      {k && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Casos" value={k.total} />
          <KpiCard label="Abiertos" value={k.abiertos} accent="#d97706" />
          <KpiCard label="Cerrados" value={k.cerrados} accent="#16a34a" />
          <KpiCard label="Ubicados en mapa" value={k.ubicados} accent="#0b5aa5" />
        </div>
      )}

      {loading && !data && <p className="text-sm text-slate-400">Cargando…</p>}

      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <MapaCasos rows={data.rows} segmento={segmento} />
            <div className="grid gap-4">
              <AbiertosCerrados abiertos={data.kpis.abiertos} cerrados={data.kpis.cerrados} />
              {segmento === 'Todos' && <CasosPorSegmento data={data.porSegmento} />}
            </div>
          </div>
          <IngresosPorDia rows={data.rows} />
          <CasosTable rows={data.rows} />
        </>
      )}
    </div>
  )
}
