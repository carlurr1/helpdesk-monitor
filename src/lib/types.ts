// Tipos compartidos entre la API y la UI.

export interface Caso {
  id: string
  numero: string
  nit: string
  cuenta_nombre: string
  tipo_registro: string
  estado: string
  categoria: string
  tipologia: string
  abierto: boolean
  fecha_apertura: string | null
  fecha_cierre: string | null
  inicio_afectacion: string | null
  fin_afectacion: string | null
  ciudad: string
  departamento: string | null
  lat: number | null
  lng: number | null
  segmento: string
  gestionado: boolean | null
  cliente_base: string | null
}

export interface KpisCasos {
  total: number
  abiertos: number
  cerrados: number
  ubicados: number
}

export interface ApiCasos {
  ok: boolean
  segmento: string
  kpis: KpisCasos
  porSegmento: Record<string, number>
  rows: Caso[]
  error?: string
}
