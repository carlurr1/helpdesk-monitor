'use client'
import { useEffect, useState } from 'react'
import { SegmentSelector } from './SegmentSelector'
import { KpiCard } from './ui/KpiCard'
import { CasosPorSegmento } from './CasosPorSegmento'
import { CasosTable } from './CasosTable'
import type { ApiCasos } from '@/lib/types'

export default function Dashboard() {
  const [segmento, setSegmento] = useState('Todos')
  const [data, setData] = useState<ApiCasos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    fetch(`/api/casos?segmento=${encodeURIComponent(segmento)}`)
      .then((r) => r.json())
      .then((j: ApiCasos) => {
        if (cancel) return
        if (j.ok) setData(j)
        else setError(j.error || 'Error desconocido')
      })
      .catch((e) => { if (!cancel) setError(String(e)) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [segmento])

  const k = data?.kpis
  return (
    <div className="space-y-6">
      <SegmentSelector value={segmento} onChange={setSegmento} counts={data?.porSegmento} />

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudieron cargar los casos: {error}.
          <br />Revisa que el esquema esté creado en Supabase y que el sync haya corrido.
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

      {data && segmento === 'Todos' && <CasosPorSegmento data={data.porSegmento} />}
      {data && <CasosTable rows={data.rows} />}
    </div>
  )
}
