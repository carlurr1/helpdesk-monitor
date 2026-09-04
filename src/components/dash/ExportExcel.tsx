'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { SEMAFORO_LABEL, type Categoria } from '@/lib/metrics'
import type { FilaTabla } from '@/lib/types'

// Descarga los abiertos (calculados en el servidor) y arma el Excel al vuelo.
export function ExportExcel({ segmento, cats, estado }: { segmento: string; cats: Categoria[]; estado: string }) {
  const [busy, setBusy] = useState(false)

  async function exportar() {
    setBusy(true)
    try {
      const qs = new URLSearchParams({ segmento, export: '1' })
      if (cats.length) qs.set('cats', cats.join(','))
      if (estado) qs.set('estado', estado)
      const res = await fetch(`/api/casos?${qs.toString()}`)
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      const abiertos: FilaTabla[] = j.abiertos ?? []

      const wb = XLSX.utils.book_new()
      const head = [['Caso', 'Cliente', 'Estado', 'Categoría', 'Tipología', 'Ciudad', 'Dirección', 'Apertura', 'Antigüedad (d)', 'Semáforo']]
      const filas = abiertos.map((r) => [
        r.numero, r.cliente, r.estado, r.categoria, r.tipologia, r.ciudad, r.direccion,
        r.fecha_apertura ? new Date(r.fecha_apertura).toLocaleString('es-CO') : '',
        String(r.edad), SEMAFORO_LABEL[r.sem],
      ])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...head, ...filas]), 'Casos abiertos')
      const fecha = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `Monitor_${segmento}_${fecha}.xlsx`)
    } catch (e) {
      alert('No se pudo exportar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={exportar} disabled={busy}
      className="flex items-center gap-1.5 rounded-full border border-teal-500 bg-white px-3 py-1.5 text-xs font-extrabold text-teal-600 hover:bg-teal-50 disabled:opacity-50">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      {busy ? 'Generando…' : 'Excel'}
    </button>
  )
}
