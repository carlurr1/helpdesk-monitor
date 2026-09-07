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
  direccion: string | null
  proceso: string | null
  origen: string | null
  id_servicio: string | null
  id_legado: string | null
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

// Punto agregado del mapa (calculado en el servidor).
export interface PuntoMapa { lat: number; lng: number; ciudad: string; seg: string; count: number }

// Fila de la tabla de abiertos (calculada en el servidor).
export interface FilaTabla {
  id: string
  numero: string
  cliente: string
  estado: string
  categoria: string
  tipologia: string
  proceso: string
  origen: string
  ciudad: string
  direccion: string
  id_servicio: string
  id_legado: string
  fecha_apertura: string | null
  edad: number
  sem: 'critical' | 'warning' | 'healthy'
}

// Distribución simple (para donas / barras).
export interface DistItem { label: string; value: number }
export interface Distribuciones {
  categoria: DistItem[]
  origen: DistItem[]
  proceso: DistItem[]
  ciudades: DistItem[]
  estados: DistItem[]
}

// Respuesta compacta: el servidor ya calculó todo (no manda filas crudas).
export interface ApiCasos {
  ok: boolean
  segmento: string
  esBogota?: boolean
  updated?: string
  kpis: KpisCasos
  porSegmento: Record<string, number>
  op?: import('./metrics').Operativo
  ej?: import('./metrics').Ejecutivo
  puntos?: PuntoMapa[]
  abiertos?: FilaTabla[]
  abiertosTotal?: number
  estados?: string[]
  dist?: Distribuciones
  clientes?: string[]
  cliente?: string
  sincronizado?: string | null
  error?: string
}
