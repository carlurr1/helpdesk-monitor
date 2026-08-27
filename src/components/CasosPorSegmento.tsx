'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { SEG_COLOR } from '@/lib/colors'

export function CasosPorSegmento({ data }: { data: Record<string, number> }) {
  const arr = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([segmento, casos]) => ({ segmento, casos }))
    .sort((a, b) => b.casos - a.casos)

  if (!arr.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Casos por segmento</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={arr} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="segmento" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Bar dataKey="casos" radius={[4, 4, 0, 0]}>
            {arr.map((d) => <Cell key={d.segmento} fill={SEG_COLOR[d.segmento] ?? '#0b5aa5'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
