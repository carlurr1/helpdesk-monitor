'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function AbiertosCerrados({ abiertos, cerrados }: { abiertos: number; cerrados: number }) {
  if (!abiertos && !cerrados) return null
  const data = [
    { name: 'Abiertos', value: abiertos, color: '#d97706' },
    { name: 'Cerrados', value: cerrados, color: '#16a34a' },
  ]
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Abiertos vs. cerrados</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
