import { SEGMENTOS } from '@/lib/segmentos'

const OPCIONES = ['Todos', ...SEGMENTOS]

export function SegmentSelector({
  value, onChange, counts,
}: {
  value: string
  onChange: (s: string) => void
  counts?: Record<string, number>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPCIONES.map((op) => {
        const active = op === value
        const n = counts?.[op]
        return (
          <button
            key={op}
            onClick={() => onChange(op)}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (active
                ? 'bg-brand text-white shadow'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-brand')
            }
          >
            {op}
            {n != null ? <span className={active ? 'opacity-80' : 'text-slate-400'}> ({n.toLocaleString('es-CO')})</span> : null}
          </button>
        )
      })}
    </div>
  )
}
