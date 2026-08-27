// Landing de arranque del monitor. La Fase 2 reemplaza esto por el tablero
// real con el selector de segmento + KPIs/tablas/gráficas.

const SEGMENTOS = [
  { nombre: 'Silver',     clientes: 17949, color: 'bg-slate-500' },
  { nombre: 'Gold',       clientes: 227,   color: 'bg-yellow-500' },
  { nombre: 'Mayoristas', clientes: 165,   color: 'bg-amber-600' },
  { nombre: 'Distrito',   clientes: 84,    color: 'bg-violet-600' },
  { nombre: 'Premium',    clientes: 79,    color: 'bg-brand' },
  { nombre: 'Élite',      clientes: 9,     color: 'bg-sky-500' },
]

const REGLAS = [
  'Tipo de registro = SOPORTE TECNICO',
  'Se excluyen los casos en estado Cancelado',
  'Sin filtro de owner — todo se cruza por NIT',
]

export default function Home() {
  const total = SEGMENTOS.reduce((a, s) => a + s.clientes, 0)
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Monitor Help Desk — ETB</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-800">Casos de soporte técnico por segmento</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Monitor unificado con datos directo de Salesforce, cruzados por NIT contra la base de
          clientes. Un selector arriba cambiará todo el tablero por segmento.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Segmentos</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {SEGMENTOS.map((s) => (
            <div key={s.nombre} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                <span className="font-semibold text-slate-700">{s.nombre}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-800">{s.clientes.toLocaleString('es-CO')}</p>
              <p className="text-xs text-slate-400">clientes</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Total base: <strong>{total.toLocaleString('es-CO')}</strong> NITs únicos.
          Mesa N1 / sin segmento → Silver.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Reglas de negocio</h2>
        <ul className="space-y-2">
          {REGLAS.map((r) => (
            <li key={r} className="flex items-start gap-2 text-slate-600">
              <span className="mt-1 text-success">✓</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Fase 0 — capa de datos lista. Próximo: ingesta + sync SF → Supabase.
      </footer>
    </main>
  )
}
