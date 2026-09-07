// Barras apiladas por categoría (Incidente/Evento/Requerimiento/Otros).
import { CAT_COLOR, type Tricolor } from '@/lib/metrics'

export function TricolorBars({
  title, subtitle, items, rank = false, onCliente,
}: { title?: string; subtitle?: string; items: Tricolor[]; rank?: boolean; onCliente?: (c: string) => void }) {
  return (
    <div className="card flex h-full flex-col">
      {title && (
        <div className="card-head">
          <div><div className="card-title">{title}</div>{subtitle && <div className="card-sub">{subtitle}</div>}</div>
          <LeyendaCategorias />
        </div>
      )}
      <div className="space-y-1.5 p-3">
        {!items.length && <p className="py-6 text-center text-sm text-[var(--muted)]">Sin datos</p>}
        {items.map((it, i) => {
          const t = it.total || 1
          const seg = [
            { c: CAT_COLOR.Incidente, w: (it.Incidente / t) * 100, k: 'Incidente', n: it.Incidente },
            { c: CAT_COLOR.Evento, w: (it.Evento / t) * 100, k: 'Evento', n: it.Evento },
            { c: CAT_COLOR.Requerimiento, w: (it.Requerimiento / t) * 100, k: 'Requerimiento', n: it.Requerimiento },
            { c: CAT_COLOR.Otros, w: (it.Otros / t) * 100, k: 'Otros', n: it.Otros },
          ].filter((s) => s.w > 0)
          return (
            <div key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-[12.5px] font-medium text-[var(--text-2)]">
                  {rank && <span className="tnum grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-md bg-[var(--surface-3)] text-[10px] font-bold text-[var(--muted)]">{i + 1}</span>}
                  {onCliente
                    ? <button onClick={() => onCliente(it.label)} className="truncate text-left hover:text-[var(--accent)] hover:underline" title={it.label}>{it.label}</button>
                    : <span className="truncate" title={it.label}>{it.label}</span>}
                </div>
                <div className="flex h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  {seg.map((s) => <div key={s.k} style={{ width: `${s.w}%`, background: s.c }} title={`${s.k}: ${s.n}`} />)}
                </div>
              </div>
              <span className="tnum text-[13px] font-bold text-[var(--text)]">{it.total.toLocaleString('es-CO')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LeyendaCategorias() {
  const items: [string, string][] = [['Incidente', CAT_COLOR.Incidente], ['Evento', CAT_COLOR.Evento], ['Requerimiento', CAT_COLOR.Requerimiento]]
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(([k, c]) => (
        <span key={k} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)]">
          <span className="h-2 w-2 rounded-sm" style={{ background: c }} />{k}
        </span>
      ))}
    </div>
  )
}
