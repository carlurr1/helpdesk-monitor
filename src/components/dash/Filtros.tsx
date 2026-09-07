'use client'
import { CATEGORIAS, CAT_COLOR, type Categoria } from '@/lib/metrics'

export function Filtros({
  cats, onToggleCat, estados, estado, onEstado, clientes, cliente, onCliente, onReset,
}: {
  cats: Categoria[]
  onToggleCat: (c: Categoria) => void
  estados: string[]
  estado: string
  onEstado: (s: string) => void
  clientes: string[]
  cliente: string
  onCliente: (c: string) => void
  onReset: () => void
}) {
  const activo = cats.length > 0 || estado !== '' || cliente !== ''
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <span className="eyebrow mr-1">Filtros</span>
      <div className="flex gap-1.5">
        {CATEGORIAS.map((c) => {
          const on = cats.includes(c)
          return (
            <button key={c} onClick={() => onToggleCat(c)}
              className={'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ' + (on ? 'text-white' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]')}
              style={on ? { background: CAT_COLOR[c], borderColor: CAT_COLOR[c] } : { borderColor: 'var(--border-strong)' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: on ? '#fff' : CAT_COLOR[c] }} />{c}
            </button>
          )
        })}
      </div>
      <span className="mx-1 h-5 w-px bg-[var(--border)]" />
      <select value={estado} onChange={(e) => onEstado(e.target.value)} className="field py-[7px]">
        <option value="">Todos los estados</option>
        {estados.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={cliente} onChange={(e) => onCliente(e.target.value)} className="field max-w-[240px] py-[7px]">
        <option value="">Todos los clientes</option>
        {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {activo && (
        <button onClick={onReset} className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          Limpiar
        </button>
      )}
    </div>
  )
}
