// Barras horizontales apiladas por categoría (Incidente/Evento/Requerimiento/Otros).
// Reproduce las "list-bar" del tablero de Apps Script.
import { CAT_COLOR, type Tricolor } from '@/lib/metrics'

export function TricolorBars({
  title, subtitle, items, rank = false,
}: { title: string; subtitle?: string; items: Tricolor[]; rank?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-brand">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      )}
      <div className="space-y-2 p-3">
        {!items.length && <p className="py-6 text-center text-sm text-slate-400">Sin datos</p>}
        {items.map((it, i) => {
          const t = it.total || 1
          const seg = [
            { c: CAT_COLOR.Incidente, w: (it.Incidente / t) * 100, n: it.Incidente, k: 'Incidente' },
            { c: CAT_COLOR.Evento, w: (it.Evento / t) * 100, n: it.Evento, k: 'Evento' },
            { c: CAT_COLOR.Requerimiento, w: (it.Requerimiento / t) * 100, n: it.Requerimiento, k: 'Requerimiento' },
            { c: CAT_COLOR.Otros, w: (it.Otros / t) * 100, n: it.Otros, k: 'Otros' },
          ].filter((s) => s.w > 0)
          const tip = `Incidente: ${it.Incidente} · Evento: ${it.Evento} · Requerimiento: ${it.Requerimiento}${it.Otros ? ` · Otros: ${it.Otros}` : ''}`
          return (
            <div key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2" title={`${it.label} — ${tip}`}>
              <div>
                <div className="mb-1 flex items-center gap-1.5 truncate text-xs font-bold text-slate-700">
                  {rank && <span className="grid h-5 w-5 place-items-center rounded-md bg-brand/10 text-[10px] text-brand">{i + 1}</span>}
                  <span className="truncate">{it.label}</span>
                </div>
                <div className="flex h-4 overflow-hidden rounded-md bg-slate-200">
                  {seg.map((s) => <div key={s.k} style={{ width: `${s.w}%`, background: s.c }} title={`${s.k}: ${s.n}`} />)}
                </div>
              </div>
              <div className="text-sm font-extrabold text-brand">{it.total.toLocaleString('es-CO')}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LeyendaCategorias() {
  const items: [string, string][] = [
    ['Incidente', CAT_COLOR.Incidente], ['Evento', CAT_COLOR.Evento], ['Requerimiento', CAT_COLOR.Requerimiento],
  ]
  return (
    <div className="mb-2 flex flex-wrap gap-3 px-1">
      {items.map(([k, c]) => (
        <span key={k} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{k}
        </span>
      ))}
    </div>
  )
}
