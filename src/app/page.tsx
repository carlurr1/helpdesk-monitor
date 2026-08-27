import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Monitor Help Desk — ETB</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-800">Casos de soporte técnico por segmento</h1>
        <p className="mt-1 text-sm text-slate-500">Datos directo de Salesforce, cruzados por NIT. Elige un segmento arriba.</p>
      </header>
      <Dashboard />
    </main>
  )
}
