// Lógica de sync SF → Supabase.casos, reutilizable por el script y el endpoint.
import { sfLogin, sfQueryAll, buildCasesSOQL, SF_CFG, cityNameFromRecord, addressFromRecord } from './salesforce'
import { normalizarNit } from './segmentos'
import { Geocoder } from './geocode'
import { supabaseServer } from './supabase'

export interface SyncResult { count: number; soql: string; geocodificados: number }

/** Trae los casos de SF (solo SOPORTE TECNICO, sin Cancelado, por NIT) y los upserta en Supabase. */
export async function syncCasos(): Promise<SyncResult> {
  const login = await sfLogin()
  const soql  = buildCasesSOQL()
  const records = await sfQueryAll(login, soql)

  const nitField  = SF_CFG.NIT_FIELD

  // Geocodificador con caché: catálogo/localidad (instantáneo) y, para lo que no
  // matchee, Nominatim sobre la dirección (CRA/CLLE → localidad + lat/lng).
  const geocoder = new Geocoder()
  await geocoder.cargarCache()

  const casos = []
  for (const c of records as any[]) {
    // Nombre legible de la ciudad (resuelve el lookup; nunca guarda el Id crudo).
    const ciudadSF = cityNameFromRecord(c)
    // Dirección: solo para geolocalizar (no se guarda cruda).
    const direccion = addressFromRecord(c)

    const geo = await geocoder.resolver(ciudadSF, direccion)
    // Ciudad a guardar: la de SF si es legible; si no, la que devolvió el geo.
    const ciudad = ciudadSF || geo?.ciudad || ''

    casos.push({
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
      direccion:         direccion || null,
      departamento:      null as string | null,
      lat:               geo?.lat ?? null,
      lng:               geo?.lng ?? null,
      sincronizado_en:   new Date().toISOString(),
    })
  }

  await geocoder.guardarCache()

  const sb = supabaseServer()
  // Si la columna `direccion` aún no existe en la tabla, degradamos: reintentamos
  // sin ese campo (el navegador igual ubica por ciudad). Recomendado: correr
  //   alter table casos add column if not exists direccion text;
  let sinDireccion = false
  for (let i = 0; i < casos.length; i += 500) {
    let lote = casos.slice(i, i + 500)
    if (sinDireccion) lote = lote.map(({ direccion, ...resto }) => resto) as typeof lote
    let { error } = await sb.from('casos').upsert(lote, { onConflict: 'id' })
    if (error && !sinDireccion && /direccion/i.test(error.message)) {
      sinDireccion = true
      lote = lote.map(({ direccion, ...resto }) => resto) as typeof lote
      ;({ error } = await sb.from('casos').upsert(lote, { onConflict: 'id' }))
    }
    if (error) throw new Error(`Supabase upsert (lote ${i}): ${error.message}`)
  }
  return { count: casos.length, soql, geocodificados: geocoder.llamadasHechas }
}
