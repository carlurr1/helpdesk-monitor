'use client'
import { useMemo, useState } from 'react'
import type { Caso } from '@/lib/types'
import { categoriaDe, edadDias, semaforo, SEMAFORO_LABEL, type Semaforo } from '@/lib/metrics'
import { ciudadLegible } from '@/lib/format'

const MAX = 250
const PILLS: { k: 'all' | Semaforo; label: string }[] = [
  { k: 'all', label: 'Todos' }, { k: 'critical', label: 'Críticos' },
  { k: 'warning', label: 'Atención' }, { k: 'healthy', label: 'Al día' },
]
const badge: Record<Semaforo, string> = {
  critical: 'bg-red-50 text-red-700', warning: 'bg-amber-50 text-amber-700', healthy: 'bg-emerald-50 text-emerald-700',
}
function fecha(s: string | null) {
  return s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

export function CasosTablaSemaforo({ rows, now }: { rows: Caso[]; now: Date }) {
  const [filtro, setFiltro] = useState<'all' | Semaforo>('all')
  const abiertos = useMemo(
    () => rows.filter((r) => r.abierto).map((r) => ({ r, edad: edadDias(r, now), sem: semaforo(edadDias(r, now)) })),
    [rows, now],
  )
  const visibles = abiertos.filter((x) => filtro === 'all' || x.sem === filtro).slice(0, MAX)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-brand">Casos abiertos</h3>
          <p className="mt-0.5 text-xs text-slate-400">{abiertos.length.toLocaleString('es-CO')} abiertos{abiertos.length > MAX ? ` · mostrando ${MAX}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PILLS.map((p) => (
            <button key={p.k} onClick={() => setFiltro(p.k)}
              className={'rounded-full border px-3 py-1 text-xs font-bold ' + (filtro === p.k ? 'border-brand/20 bg-brand/10 text-brand' : 'border-slate-200 bg-white text-slate-600 hover:border-brand')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Semáforo</th><th className="px-4 py-2">Caso</th><th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Estado</th><th className="px-4 py-2">Categoría</th><th className="px-4 py-2">Tipología</th>
              <th className="px-4 py-2">Ciudad</th><th className="px-4 py-2">Apertura</th><th className="px-4 py-2">Antigüedad</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ r, edad, sem }) => (
              <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2"><span className={'rounded-full px-2 py-0.5 text-[11px] font-bold ' + badge[sem]}>{SEMAFORO_LABEL[sem]}</span></td>
                <td className="px-4 py-2 font-medium text-slate-700">{r.numero}</td>
                <td className="px-4 py-2 text-slate-600">{r.cuenta_nombre || r.cliente_base || r.nit || '—'}</td>
                <td className="px-4 py-2 text-slate-600">{r.estado || '—'}</td>
                <td className="px-4 py-2 text-slate-600">{categoriaDe(r)}</td>
                <td className="px-4 py-2 text-slate-500">{r.tipologia || '—'}</td>
                <td className="px-4 py-2 text-slate-600">{ciudadLegible(r.ciudad)}</td>
                <td className="px-4 py-2 text-slate-500">{fecha(r.fecha_apertura)}</td>
                <td className="px-4 py-2 font-semibold text-slate-700">{edad.toLocaleString('es-CO')} d</td>
              </tr>
            ))}
            {!visibles.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Sin casos para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
