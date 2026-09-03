'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Caso } from '@/lib/types'

// Casos ingresados (fecha_apertura) por día en los últimos 30 días.
export function IngresosPorDia({ rows }: { rows: Caso[] }) {
  const hoy = new Date()
  const dias: { dia: string; casos: number }[] = []
  const idx = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    idx.set(k, dias.length)
    dias.push({ dia: k.slice(5), casos: 0 })
  }
  for (const r of rows) {
    if (!r.fecha_apertura) continue
    const k = new Date(r.fecha_apertura).toISOString().slice(0, 10)
    const i = idx.get(k)
    if (i != null) dias[i].casos++
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Ingresos por día (últimos 30)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dias} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval={4} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
          <Tooltip formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Line type="monotone" dataKey="casos" stroke="#0b5aa5" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
