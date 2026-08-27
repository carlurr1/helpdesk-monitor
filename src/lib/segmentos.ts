// ============================================================
//  Normalización de segmentos + NIT
//  La MESA es la fuente de verdad para el segmento (18.513 NITs, mesa siempre
//  presente en la base). La columna SEGMENTO vieja es ruidosa: marca "MAYORISTAS"
//  a proyecciones/demos que en realidad están en mesa N1 y son Silver.
//  Regla de negocio: mesa N1 (y todo lo que no sea un segmento nombrado) → Silver.
//  No hay bucket "Otros": toda la base cae en uno de los 6 segmentos.
// ============================================================

export type Segmento = 'Distrito' | 'Élite' | 'Premium' | 'Mayoristas' | 'Silver' | 'Gold'

export const SEGMENTOS: Segmento[] = ['Distrito', 'Élite', 'Premium', 'Mayoristas', 'Silver', 'Gold']

/** Fila cruda de la base de clientes (Excel). Solo se usan estas columnas. */
export interface ClienteRow {
  ID_IDENTIFICACION?: string | number
  NOMBRE_CUENTA?: string
  PROPIETARIO_CUENTA?: string
  SEGMENTO?: string
  SEGMENTO_UEN?: string
  MESA?: string
  [k: string]: unknown
}

// Mesa → segmento. Solo las mesas con nombre de segmento se mapean explícito;
// P1..P5 son Premium; el resto (S1/S2/S6, N1, U1, vacío) cae a Silver.
const MESA_MAP: Record<string, Segmento> = {
  MAYORISTAS: 'Mayoristas',
  GOLD:       'Gold',
  DISTRITO:   'Distrito',
  ELITE:      'Élite',
  MEN:        'Premium',   // mesa premium (sector educación)
}

/** Devuelve el segmento normalizado de una fila de la base, guiándose por MESA. */
export function segmentoDe(row: ClienteRow): Segmento {
  const mesa = String(row.MESA ?? '').trim().toUpperCase()
  if (MESA_MAP[mesa])      return MESA_MAP[mesa]
  if (/^P\d+$/.test(mesa)) return 'Premium'   // P1..P5
  // S1/S2/S6 (Silver), N1 (proyección/NUEVO), U1 (Universidades), vacío → Silver
  return 'Silver'
}

/** Con la regla actual toda la base es gestionada; se conserva por claridad de intención. */
export function esGestionado(segmento: string): boolean {
  return (SEGMENTOS as string[]).includes(segmento)
}

// ── NIT ────────────────────────────────────────────────────
// La base trae ID_IDENTIFICACION; en Salesforce el campo es "Número de Documento".
// Distrito/Élite (entidades distritales) tienen NITs atípicos que no calzan directo.
// Pega aquí el cruce que hiciste en Colab:  <nit_base> : <numero_documento_SF>
export const NIT_OVERRIDES: Record<string, string> = {
  // '899999999': '899999999-1',
}

/** Normaliza un NIT: solo dígitos, aplica overrides de Distrito/Élite. */
export function normalizarNit(v: unknown): string {
  const n = String(v ?? '').replace(/\D/g, '').trim()
  return NIT_OVERRIDES[n] ?? n
}
