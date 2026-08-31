import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Monitor Help Desk — ETB</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-800">Casos de soporte técnico por segmento</h1>
          <p className="mt-1 text-sm text-slate-500">Datos directo de Salesforce, cruzados por NIT. Elige un segmento arriba.</p>
        </div>
        <a href="/admin" className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand">
          ⚙︎ Configuración
        </a>
      </header>
      <Dashboard />
    </main>
  )
}
