'use client'

function haceCuanto(iso?: string | null): string {
  if (!iso) return '—'
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export function Topbar({
  segmento, tab, updated, sincronizado, cliente, onClearCliente, onRefresh, onMenu, right,
}: {
  segmento: string
  tab: 'operacion' | 'ejecutivo'
  updated: Date | null
  sincronizado?: string | null
  cliente: string
  onClearCliente: () => void
  onRefresh: () => void
  onMenu?: () => void
  right?: React.ReactNode
}) {
  const vista = tab === 'operacion' ? 'Operativo' : 'Ejecutivo'
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {onMenu && (
            <button onClick={onMenu} className="btn btn-sm px-2 lg:hidden" aria-label="Menú">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          )}
          <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
            <span>Monitor</span><span className="opacity-50">/</span><span>{vista}</span>
            <span className="opacity-50">/</span><span className="text-[var(--text-2)]">{segmento}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--text)]">
              {segmento === 'Todos' ? 'Casos de soporte · Colombia' : `Segmento ${segmento}`}
            </h1>
            {cliente && (
              <button onClick={onClearCliente} className="badge badge-accent" title="Quitar filtro de cliente">
                {cliente.length > 26 ? cliente.slice(0, 26) + '…' : cliente} ✕
              </button>
            )}
          </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-right text-[11px] leading-tight text-[var(--muted)] sm:block" title="La sincronización trae casos nuevos desde Salesforce; la relectura solo actualiza la pantalla.">
            <span className="block font-semibold text-[var(--text-2)]">Salesforce {haceCuanto(sincronizado)}</span>
            <span className="block">Pantalla {updated ? updated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '…'}</span>
          </span>
          {right}
          <button onClick={onRefresh} className="btn btn-sm" title="Actualizar ahora">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>
            Refrescar
          </button>
        </div>
      </div>
    </header>
  )
}
