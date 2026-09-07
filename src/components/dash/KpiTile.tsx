// Tarjeta KPI enterprise. Neutra por defecto; el color se usa con intención
// (tono semántico) y un acento fino a la izquierda.
type Tone = 'neutral' | 'accent' | 'danger' | 'warning' | 'success'

const BAR: Record<Tone, string> = {
  neutral: '#cbd2dd', accent: '#0b5aa5', danger: '#d92d20', warning: '#dc6803', success: '#12946a',
}
const VAL: Record<Tone, string> = {
  neutral: 'var(--text)', accent: 'var(--text)', danger: '#b42318', warning: '#b54708', success: '#087443',
}

export function KpiTile({
  label, value, meta, tone = 'neutral', accent,
}: { label: string; value: string | number; meta?: string; tone?: Tone; accent?: string }) {
  const bar = accent || BAR[tone]
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-[14px] shadow-[var(--shadow-sm)]">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: bar }} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tnum" style={{ color: tone === 'neutral' && !accent ? 'var(--text)' : VAL[tone] }}>
        {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
      </div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  )
}

// KPI destacado (mayor peso visual) para las métricas principales.
export function KpiHero({
  label, value, meta, sub,
}: { label: string; value: string | number; meta?: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="kpi-label">{label}</div>
      <div className="mt-2 flex items-end gap-3">
        <div className="tnum text-[34px] font-extrabold leading-none text-[var(--text)]">
          {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
        </div>
        {meta && <div className="pb-1 text-[12px] font-medium text-[var(--text-2)]">{meta}</div>}
      </div>
      {sub && <div className="mt-3 border-t border-[var(--border)] pt-3">{sub}</div>}
    </div>
  )
}
