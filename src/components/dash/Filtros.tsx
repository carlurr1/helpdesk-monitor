'use client'
import { CATEGORIAS, type Categoria } from '@/lib/metrics'

const CHIP: Record<Categoria, string> = {
  Incidente: 'data-[on=true]:bg-[#ea6b5d] data-[on=true]:text-white data-[on=true]:border-[#ea6b5d] text-[#b42318] bg-[#ea6b5d]/10',
  Evento: 'data-[on=true]:bg-[#f79009] data-[on=true]:text-white data-[on=true]:border-[#f79009] text-[#b54708] bg-[#f79009]/10',
  Requerimiento: 'data-[on=true]:bg-[#0b5aa5] data-[on=true]:text-white data-[on=true]:border-[#0b5aa5] text-[#0b5aa5] bg-[#0b5aa5]/10',
  Otros: '',
}

export function Filtros({
  cats, onToggleCat, estados, estado, onEstado, onReset,
}: {
  cats: Categoria[]
  onToggleCat: (c: Categoria) => void
  estados: string[]
  estado: string
  onEstado: (s: string) => void
  onReset: () => void
}) {
  const activo = cats.length > 0 || estado !== ''
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Filtrar</span>
      <div className="flex gap-1.5">
        {CATEGORIAS.map((c) => (
          <button key={c} data-on={cats.includes(c)} onClick={() => onToggleCat(c)}
            className={'rounded-full border border-transparent px-3 py-1.5 text-[11px] font-extrabold ' + CHIP[c]}>
            ● {c}
          </button>
        ))}
      </div>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <select value={estado} onChange={(e) => onEstado(e.target.value)}
        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-brand">
        <option value="">Todos los estados</option>
        {estados.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {activo && (
        <button onClick={onReset} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-extrabold text-slate-500 hover:bg-slate-50">
          ✕ Limpiar
        </button>
      )}
    </div>
  )
}
