'use client'
import { SEGMENTOS } from '@/lib/segmentos'

type Tab = 'operacion' | 'ejecutivo'

// Íconos inline (sin librería) — trazo fino, coherentes.
const I = {
  pulse: 'M3 12h4l2 6 4-14 2 8h4',
  exec: 'M4 19V5m5 14V9m5 10v-6m5 6V7',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5',
  dot: '',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L4.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
  out: 'M15 12H3m0 0 4-4m-4 4 4 4M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6',
}

function Ico({ d }: { d: string }) {
  return <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
}

const SEG_DOT: Record<string, string> = {
  Distrito: '#7c5cff', 'Élite': '#12b7b0', Premium: '#0b5aa5', Mayoristas: '#dc6803', Silver: '#8a94a6', Gold: '#caa53a',
}

export function Sidebar({
  tab, onTab, segmento, onSegmento, counts, onLogout,
}: {
  tab: Tab; onTab: (t: Tab) => void
  segmento: string; onSegmento: (s: string) => void
  counts?: Record<string, number>; onLogout: () => void
}) {
  const opciones = ['Todos', ...SEGMENTOS]
  return (
    <aside className="flex h-screen w-[236px] flex-col" style={{ background: 'var(--sidebar)' }}>
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'linear-gradient(135deg,#1f7ad1,#0b5aa5)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3"><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 5-7" /></svg>
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-bold text-white">Monitor ETB</div>
          <div className="text-[10.5px] font-medium tracking-wide text-slate-500">Help Desk · Ops</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="nav-group">Monitor</div>
        <div className={'nav-item' + (tab === 'operacion' ? ' active' : '')} onClick={() => onTab('operacion')}><Ico d={I.pulse} /> Operativo</div>
        <div className={'nav-item' + (tab === 'ejecutivo' ? ' active' : '')} onClick={() => onTab('ejecutivo')}><Ico d={I.exec} /> Ejecutivo</div>

        <div className="nav-group flex items-center justify-between">
          <span>Segmentos</span>
          <span className="text-[9px] font-semibold normal-case tracking-normal text-slate-600">abiertos</span>
        </div>
        {opciones.map((s) => {
          const n = counts?.[s]
          const active = s === segmento
          return (
            <div key={s} className={'nav-item justify-between' + (active ? ' active' : '')} onClick={() => onSegmento(s)}>
              <span className="flex items-center gap-2.5 truncate">
                {s === 'Todos'
                  ? <Ico d={I.layers} />
                  : <span className="nav-ico grid place-items-center"><span className="h-2 w-2 rounded-full" style={{ background: SEG_DOT[s] || '#8a94a6' }} /></span>}
                <span className="truncate">{s}</span>
              </span>
              {n != null && <span title="Casos abiertos" className="tnum rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: 'rgba(255,255,255,0.07)', color: '#c3ccdb' }}>{n.toLocaleString('es-CO')}</span>}
            </div>
          )
        })}

        <div className="nav-group">Sistema</div>
        <a href="/admin" className="nav-item"><Ico d={I.cog} /> Configuración</a>
        <div className="nav-item" onClick={onLogout}><Ico d={I.out} /> Salir</div>
      </nav>

      <div className="border-t border-white/5 px-5 py-3">
        <div className="text-[10.5px] text-slate-600">Datos: Salesforce · Supabase</div>
      </div>
    </aside>
  )
}
