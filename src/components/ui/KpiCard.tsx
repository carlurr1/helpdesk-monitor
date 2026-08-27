export function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: accent ?? '#1e293b' }}>
        {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
      </p>
    </div>
  )
}
