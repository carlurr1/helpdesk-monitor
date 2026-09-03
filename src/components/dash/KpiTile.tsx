// Tarjeta KPI del tablero (grilla superior).
export function KpiTile({
  label, value, meta, accent = '#0b5aa5',
}: { label: string; value: string | number; meta?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-extrabold leading-none" style={{ color: accent }}>
        {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
      </div>
      {meta && <div className="mt-2 text-xs text-slate-400">{meta}</div>}
    </div>
  )
}
