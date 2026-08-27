// ============================================================
//  Sync de casos: Salesforce → Supabase.casos
//  Trae SOLO SOPORTE TECNICO, sin Cancelado, todo por NIT (sin owner).
//  Uso:  npm run sync
//  (Ideal correrlo por cron cada pocos minutos.)
// ============================================================
import { sfLogin, sfQueryAll, buildCasesSOQL, SF_CFG } from '../src/lib/salesforce'
import { normalizarNit } from '../src/lib/segmentos'
import { resolverGeo } from '../src/lib/geo'
import { supabaseServer } from '../src/lib/supabase'

async function main() {
  const login = await sfLogin()
  const soql  = buildCasesSOQL()
  console.log('SOQL:', soql.replace(/\s+/g, ' ').trim())

  const records = await sfQueryAll(login, soql)
  console.log(`Casos traídos de SF: ${records.length}`)

  const nitField  = SF_CFG.NIT_FIELD
  const cityField = SF_CFG.CITY_FIELD

  const casos = records.map((c: any) => {
    const ciudad = String(c[cityField] ?? '')
    const geo = resolverGeo({ ciudad })
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
      departamento:      null,
      lat:               geo?.lat ?? null,
      lng:               geo?.lng ?? null,
      sincronizado_en:   new Date().toISOString(),
    }
  })

  const sb = supabaseServer()
  for (let i = 0; i < casos.length; i += 500) {
    const lote = casos.slice(i, i + 500)
    const { error } = await sb.from('casos').upsert(lote, { onConflict: 'id' })
    if (error) { console.error('Error en lote', i, '→', error.message); process.exit(1) }
    console.log(`  upsert ${Math.min(i + 500, casos.length)}/${casos.length}`)
  }
  console.log('Sync completo.')
}

main().catch((e) => { console.error(e); process.exit(1) })
