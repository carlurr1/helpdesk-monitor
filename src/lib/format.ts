// Utilidades de presentación compartidas (cliente y servidor).

/** true si el valor parece un Id de Salesforce (15 o 18 caracteres alfanuméricos). */
export function esIdSalesforce(v: unknown): boolean {
  return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(String(v ?? '').trim())
}

/**
 * Devuelve la ciudad lista para mostrar. Si el valor guardado es un Id de
 * Salesforce (datos viejos sincronizados antes del arreglo) devuelve el
 * placeholder en vez del Id crudo, para no ensuciar tablas ni mapas.
 */
export function ciudadLegible(v: string | null | undefined, placeholder = '—'): string {
  const s = String(v ?? '').trim()
  if (!s || esIdSalesforce(s)) return placeholder
  return s
}
