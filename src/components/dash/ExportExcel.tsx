'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { SEMAFORO_LABEL, type Categoria } from '@/lib/metrics'
import type { FilaTabla } from '@/lib/types'

// Descarga los abiertos (calculados en el servidor) y arma el Excel al vuelo.
export function ExportExcel({ segmento, cats, estado, cliente }: { segmento: string; cats: Categoria[]; estado: string; cliente: string }) {
  const [busy, setBusy] = useState(false)

  async function exportar() {
    setBusy(true)
    try {
      const qs = new URLSearchParams({ segmento, export: '1' })
      if (cats.length) qs.set('cats', cats.join(','))
      if (estado) qs.set('estado', estado)
      if (cliente) qs.set('cliente', cliente)
      const res = await fetch(`/api/casos?${qs.toString()}`)
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      const abiertos: FilaTabla[] = j.abiertos ?? []

      const wb = XLSX.utils.book_new()
      const head = [['Semáforo', 'Caso', 'Cliente', 'Estado', 'Tipología', 'Categoría', 'Proceso', 'Origen', 'Apertura', 'Antigüedad (d)', 'Ciudad', 'Dirección', 'ID Servicio', 'ID Legado']]
      const filas = abiertos.map((r) => [
        SEMAFORO_LABEL[r.sem], r.numero, r.cliente, r.estado, r.tipologia, r.categoria, r.proceso, r.origen,
        r.fecha_apertura ? new Date(r.fecha_apertura).toLocaleString('es-CO') : '', String(r.edad),
        r.ciudad, r.direccion, r.id_servicio, r.id_legado,
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
    <button onClick={exportar} disabled={busy} className="btn btn-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      {busy ? 'Generando…' : 'Exportar'}
    </button>
  )
}
