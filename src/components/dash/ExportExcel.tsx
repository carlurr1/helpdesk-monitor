'use client'
import * as XLSX from 'xlsx'
import type { Caso } from '@/lib/types'
import { categoriaDe, edadDias, semaforo, SEMAFORO_LABEL, computeOperativo } from '@/lib/metrics'
import { ciudadLegible } from '@/lib/format'

export function ExportExcel({ rows, now, segmento }: { rows: Caso[]; now: Date; segmento: string }) {
  function exportar() {
    const wb = XLSX.utils.book_new()
    const op = computeOperativo(rows, now)
    const k = op.kpis
    const kpis = [
      ['Métrica', 'Valor'],
      ['Segmento', segmento],
      ['Casos abiertos', k.abiertos],
      ['Ingresos mes', k.ingresosMes],
      ['Cierres mes', k.cierresMes],
      ['Antigüedad promedio (días)', k.antiguedadProm],
      ['% Críticos', k.pctCriticos + '%'],
      ['% Atención', k.pctAtencion + '%'],
      ['Clientes abiertos', k.clientesAbiertos],
      ['Ingresos hoy', k.ingresosHoy],
      ['Cierres hoy', k.cierresHoy],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpis), 'KPIs')

    const tend = [['Fecha', 'Ingresos', 'Cierres']]
    op.tendencia.forEach((t) => tend.push([t.dia, String(t.ingresos), String(t.cierres)]))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tend), 'Tendencia')

    const casos = [['Caso', 'Cliente', 'Estado', 'Categoría', 'Tipología', 'Ciudad', 'Apertura', 'Antigüedad (d)', 'Semáforo']]
    rows.filter((r) => r.abierto).forEach((r) => {
      const edad = edadDias(r, now)
      casos.push([
        r.numero, r.cuenta_nombre || r.cliente_base || r.nit || '', r.estado || '', categoriaDe(r),
        r.tipologia || '', ciudadLegible(r.ciudad, ''), r.fecha_apertura ? new Date(r.fecha_apertura).toLocaleString('es-CO') : '',
        String(edad), SEMAFORO_LABEL[semaforo(edad)],
      ])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(casos), 'Casos abiertos')

    const fecha = now.toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Monitor_${segmento}_${fecha}.xlsx`)
  }

  return (
    <button onClick={exportar}
      className="flex items-center gap-1.5 rounded-full border border-teal-500 bg-white px-3 py-1.5 text-xs font-extrabold text-teal-600 hover:bg-teal-50">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      Excel
    </button>
  )
}
