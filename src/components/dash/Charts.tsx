'use client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
  PieChart, Pie,
} from 'recharts'
import type { TendenciaPunto, TmsPunto, AgingBuckets, DistItem } from '@/lib/metrics'
import { CAT_COLOR } from '@/lib/metrics'

const AXIS = '#98a2b3'
const GRID = '#eef1f5'

function Panel({ title, subtitle, right, children, pad = true }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <div className="card flex flex-col">
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid #e6e8ec', boxShadow: '0 4px 14px -6px rgba(16,24,40,.12)', fontSize: 12 },
  labelStyle: { color: '#101828', fontWeight: 600 },
}

export function TendenciaChart({ data, showAbiertos = true, title = 'Tendencia operativa', subtitle }: {
  data: TendenciaPunto[]; showAbiertos?: boolean; title?: string; subtitle?: string
}) {
  return (
    <Panel title={title} subtitle={subtitle ?? 'Ingresos, cierres y abiertos (14 días)'}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: AXIS }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: AXIS }} allowDecimals={false} width={34} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="plainline" />
          <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#dc6803" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cierres" name="Cierres" stroke="#12b7b0" strokeWidth={2} dot={false} />
          {showAbiertos && <Line type="monotone" dataKey="abiertos" name="Abiertos" stroke="#0b5aa5" strokeWidth={2} dot={false} strokeDasharray="4 3" />}
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function TmsChart({ data }: { data: TmsPunto[] }) {
  return (
    <Panel title="Tiempo medio de solución" subtitle="Horas promedio por día (14 días)">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: AXIS }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: AXIS }} width={36} tickFormatter={(v) => `${v}h`} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => `${v} h`} />
          <Line type="monotone" dataKey="tms" name="TMS (h)" stroke="#e0654f" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  )
}

const AGING_COLORS = ['#12946a', '#66b98f', '#dc9a06', '#dd7a3f', '#d92d20']

export function AgingChart({ aging }: { aging: AgingBuckets }) {
  const data = (Object.keys(aging) as (keyof AgingBuckets)[]).map((k) => ({ rango: k, casos: aging[k] }))
  return (
    <Panel title="Antigüedad de abiertos" subtitle="Distribución por días">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="rango" tick={{ fontSize: 11, fill: AXIS }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: AXIS }} allowDecimals={false} width={34} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} cursor={{ fill: '#f2f4f7' }} formatter={(v: number) => v.toLocaleString('es-CO')} />
          <Bar dataKey="casos" radius={[5, 5, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

// Dona de categoría (abiertos).
export function DonutCategoria({ data }: { data: DistItem[] }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const color = (l: string) => (CAT_COLOR as any)[l] || '#b0c0d0'
  return (
    <Panel title="Mezcla por categoría" subtitle="Casos abiertos">
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="52%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.label} fill={color(d.label)} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v: number) => v.toLocaleString('es-CO')} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.label} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-[var(--text-2)]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(d.label) }} />{d.label}</span>
              <span className="tnum font-semibold text-[var(--text)]">{Math.round((d.value / total) * 100)}%</span>
            </div>
          ))}
          {!data.length && <p className="text-sm text-[var(--muted)]">Sin datos</p>}
        </div>
      </div>
    </Panel>
  )
}

// Lista de barras horizontales (origen / proceso / ciudades…).
export function BarList({ title, subtitle, data, color = '#0b5aa5' }: { title: string; subtitle?: string; data: DistItem[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="space-y-2.5">
        {!data.length && <p className="py-6 text-center text-sm text-[var(--muted)]">Sin datos</p>}
        {data.map((d) => (
          <div key={d.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="truncate text-[var(--text-2)]" title={d.label}>{d.label}</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
              </div>
            </div>
            <span className="tnum w-12 text-right text-[13px] font-semibold text-[var(--text)]">{d.value.toLocaleString('es-CO')}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
