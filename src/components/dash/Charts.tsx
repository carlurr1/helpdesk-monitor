'use client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from 'recharts'
import type { TendenciaPunto, TmsPunto, AgingBuckets } from '@/lib/metrics'
import { ETB } from '@/lib/colors'

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-brand">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export function TendenciaChart({ data, showAbiertos = true, title = 'Tendencia operativa', subtitle }: {
  data: TendenciaPunto[]; showAbiertos?: boolean; title?: string; subtitle?: string
}) {
  return (
    <Panel title={title} subtitle={subtitle ?? 'Ingresos, cierres y abiertos'}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 4, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
          <Tooltip formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke={ETB.yellow} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cierres" name="Cierres" stroke={ETB.teal} strokeWidth={2} dot={false} />
          {showAbiertos && <Line type="monotone" dataKey="abiertos" name="Abiertos" stroke={ETB.blue} strokeWidth={2} dot={false} strokeDasharray="4 3" />}
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function TmsChart({ data }: { data: TmsPunto[] }) {
  return (
    <Panel title="TMS diario promedio" subtitle="Horas de solución (últimos 14 días)">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 4, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} width={34} tickFormatter={(v) => `${v}h`} />
          <Tooltip formatter={(v: number) => `${v} h`} />
          <Line type="monotone" dataKey="tms" name="TMS (h)" stroke={ETB.coral} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  )
}

const AGING_COLORS = ['#12b76a', '#7cd992', '#f7b955', '#ea8d68', '#ea6b5d']

export function AgingChart({ aging }: { aging: AgingBuckets }) {
  const data = (Object.keys(aging) as (keyof AgingBuckets)[]).map((k) => ({ rango: k, casos: aging[k] }))
  return (
    <Panel title="Antigüedad de abiertos" subtitle="Distribución por días de antigüedad">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 6, right: 10, bottom: 4, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
          <Tooltip formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Bar dataKey="casos" radius={[8, 8, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}
