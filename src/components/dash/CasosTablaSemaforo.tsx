'use client'
import { useMemo, useState } from 'react'
import { SEMAFORO_LABEL, type Semaforo } from '@/lib/metrics'
import { CAT_COLOR } from '@/lib/metrics'
import type { FilaTabla } from '@/lib/types'

const PILLS: { k: 'all' | Semaforo; label: string }[] = [
  { k: 'all', label: 'Todos' }, { k: 'critical', label: 'Críticos' },
  { k: 'warning', label: 'Atención' }, { k: 'healthy', label: 'Al día' },
]
const badge: Record<Semaforo, string> = { critical: 'badge-danger', warning: 'badge-warning', healthy: 'badge-success' }
function fecha(s: string | null) {
  return s ? new Date(s).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
const COLS = ['Semáforo', 'Caso', 'Cliente', 'Segmento', 'Estado', 'Tipología', 'Categoría', 'Proceso', 'Origen', 'Apertura', 'Antigüedad', 'Ciudad', 'Dirección', 'ID Servicio', 'ID Legado']
const RENDER_CAP = 400 // filas que se pintan sin búsqueda (el buscador sí recorre todas).

export function CasosTablaSemaforo({
  abiertos, total, onCliente,
}: { abiertos: FilaTabla[]; total: number; onCliente?: (c: string) => void }) {
  const [filtro, setFiltro] = useState<'all' | Semaforo>('all')
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState<string | null>(null)

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return abiertos.filter((x) => (filtro === 'all' || x.sem === filtro) &&
      (!t || x.numero.toLowerCase().includes(t) || x.cliente.toLowerCase().includes(t) ||
        (x.segmento || '').toLowerCase().includes(t) ||
        (x.id_legado || '').toLowerCase().includes(t) || (x.id_servicio || '').toLowerCase().includes(t)))
  }, [abiertos, filtro, q])
  // Sin búsqueda se pintan solo las primeras filas (DOM liviano); al buscar se
  // recorren y muestran TODAS las coincidencias, para hallar cualquier caso.
  const buscando = q.trim().length > 0
  const visibles = buscando ? filtradas : filtradas.slice(0, RENDER_CAP)
  const ocultas = filtradas.length - visibles.length

  return (
    <div className="card">
      <div className="card-head flex-wrap">
        <div>
          <div className="card-title">Casos abiertos</div>
          <div className="card-sub">{total.toLocaleString('es-CO')} abiertos{total > abiertos.length ? ` · mostrando ${abiertos.length}` : ''}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar caso, cliente, ID…" className="field w-56 pl-8" />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border-strong)]">
            {PILLS.map((p) => (
              <button key={p.k} onClick={() => setFiltro(p.k)}
                className={'px-3 py-[7px] text-[12px] font-semibold ' + (filtro === p.k ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[1550px]">
          <thead>
            <tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.id}>
                <td><span className={'badge ' + badge[r.sem]}>{SEMAFORO_LABEL[r.sem]}</span></td>
                <td className="font-semibold text-[var(--text)]">{r.numero}</td>
                <td className="relative">
                  <button onClick={() => setMenu(menu === r.id ? null : r.id)} className="max-w-[220px] truncate text-left font-medium text-[var(--accent)] hover:underline" title={r.cliente}>
                    {r.cliente}
                  </button>
                  {menu === r.id && (
                    <div className="absolute left-3 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow-md)]" onMouseLeave={() => setMenu(null)}>
                      <button onClick={() => { onCliente?.(r.cliente); setMenu(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface-2)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" /></svg>
                        Ver solo este cliente
                      </button>
                      <a href={`https://etb.lightning.force.com`} target="_blank" rel="noreferrer" className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-left text-[13px] text-[var(--text-2)] hover:bg-[var(--surface-2)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>
                        Abrir en Salesforce
                      </a>
                    </div>
                  )}
                </td>
                <td><span className="badge badge-neutral">{r.segmento || '—'}</span></td>
                <td><span className="badge badge-neutral">{r.estado || '—'}</span></td>
                <td className="max-w-[240px] truncate text-[var(--text-2)]" title={r.tipologia}>{r.tipologia || '—'}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5 text-[var(--text-2)]">
                    <span className="h-2 w-2 rounded-full" style={{ background: (CAT_COLOR as any)[r.categoria] || '#b0c0d0' }} />{r.categoria}
                  </span>
                </td>
                <td className="text-[var(--text-2)]">{r.proceso || '—'}</td>
                <td className="text-[var(--text-2)]">{r.origen || '—'}</td>
                <td className="tnum whitespace-nowrap text-[var(--muted)]">{fecha(r.fecha_apertura)}</td>
                <td className="tnum font-semibold text-[var(--text)]">{r.edad.toLocaleString('es-CO')} d</td>
                <td className="text-[var(--text-2)]">{r.ciudad || '—'}</td>
                <td className="max-w-[200px] truncate text-[var(--muted)]" title={r.direccion}>{r.direccion || '—'}</td>
                <td className="tnum text-[var(--text-2)]">{r.id_servicio || '—'}</td>
                <td className="tnum text-[var(--text-2)]">{r.id_legado || '—'}</td>
              </tr>
            ))}
            {!visibles.length && <tr><td colSpan={COLS.length} className="py-10 text-center text-[var(--muted)]">Sin casos para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      {ocultas > 0 && (
        <div className="border-t border-[var(--border)] px-4 py-2.5 text-[12px] text-[var(--muted)]">
          Mostrando {visibles.length.toLocaleString('es-CO')} de {filtradas.length.toLocaleString('es-CO')}. Usa el buscador (caso, cliente, segmento o ID) para encontrar cualquiera de los {ocultas.toLocaleString('es-CO')} restantes.
        </div>
      )}
    </div>
  )
}
