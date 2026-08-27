import type { Caso } from '@/lib/types'
import { SEG_COLOR } from '@/lib/colors'

const MAX = 200

function fecha(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CasosTable({ rows }: { rows: Caso[] }) {
  const visible = rows.slice(0, MAX)
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Casos</h3>
        <span className="text-xs text-slate-400">
          {rows.length.toLocaleString('es-CO')} en total{rows.length > MAX ? ` · mostrando ${MAX}` : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Caso</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Segmento</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Ciudad</th>
              <th className="px-4 py-2">Apertura</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-700">{c.numero}</td>
                <td className="px-4 py-2 text-slate-600">{c.cuenta_nombre || c.cliente_base || c.nit}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SEG_COLOR[c.segmento] ?? '#cbd5e1' }} />
                    {c.segmento}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (c.abierto ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                    {c.estado || (c.abierto ? 'Abierto' : 'Cerrado')}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{c.ciudad || '—'}</td>
                <td className="px-4 py-2 text-slate-500">{fecha(c.fecha_apertura)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin casos para este segmento.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
