// Lógica de sync SF → Supabase.casos, reutilizable por el script y el endpoint.
import { sfLogin, sfQueryAll, buildCasesSOQL, SF_CFG, cityNameFromRecord, addressFromRecord } from './salesforce'
import { normalizarNit } from './segmentos'
import { resolverGeo, geolocalizarTexto } from './geo'
import { supabaseServer } from './supabase'

export interface SyncResult { count: number; soql: string }

/** Trae los casos de SF (solo SOPORTE TECNICO, sin Cancelado, por NIT) y los upserta en Supabase. */
export async function syncCasos(): Promise<SyncResult> {
  const login = await sfLogin()
  const soql  = buildCasesSOQL()
  const records = await sfQueryAll(login, soql)

  const nitField  = SF_CFG.NIT_FIELD

  const casos = records.map((c: any) => {
    // Nombre legible de la ciudad (resuelve el lookup; nunca guarda el Id crudo).
    const ciudadSF = cityNameFromRecord(c)
    // Dirección: solo para geolocalizar cruzando el texto (como el script de GAS).
    const direccion = addressFromRecord(c)

    // 1º intento: la ciudad como tal (o localidad de Bogotá) por diccionario exacto.
    let geo = resolverGeo({ ciudad: ciudadSF, localidad: ciudadSF })
    // Nombre a guardar: el de SF si es legible; si no, se completa abajo.
    let ciudad = ciudadSF
    // 2º intento: escanear el texto libre (ciudad + dirección) buscando una
    // localidad de Bogotá o una ciudad conocida dentro de la cadena.
    if (!geo) {
      const t = geolocalizarTexto(ciudadSF, direccion)
      if (t) { geo = t.geo; if (!ciudad) ciudad = t.nombre }
    }
    return {
      id:                c.Id,
      numero:            c.CaseNumber ?? '',
      nit:               normalizarNit(c[nitField]),
      cuenta_nombre:     c.Account?.Name ?? '',
      tipo_registro:     c.RecordType?.Name ?? '',
      estado:            c.Status ?? '',
      categoria:         c.Categoria_legado__c ?? c.TipoCaso__c ?? '',
      tipologia:         c.Tipologia__c ?? '',
      abierto:           c.IsClosed === false,
      fecha_apertura:    c.CreatedDate ?? null,
      fecha_cierre:      c.ClosedDate ?? null,
      inicio_afectacion: c.FechaInicioAfectacion__c ?? null,
      fin_afectacion:    c.FechaFinAfectacion__c ?? null,
      ciudad,
      departamento:      null as string | null,
      lat:               geo?.lat ?? null,
      lng:               geo?.lng ?? null,
      sincronizado_en:   new Date().toISOString(),
    }
  })

  const sb = supabaseServer()
  for (let i = 0; i < casos.length; i += 500) {
    const lote = casos.slice(i, i + 500)
    const { error } = await sb.from('casos').upsert(lote, { onConflict: 'id' })
    if (error) throw new Error(`Supabase upsert (lote ${i}): ${error.message}`)
  }
  return { count: casos.length, soql }
}
