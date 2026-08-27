// ============================================================
//  Ingesta de la base de clientes (Excel) → Supabase.clientes
//  Uso:
//    npm run ingest     -- ./BASE_CLIENTES.xlsx    (sube a Supabase)
//    npm run ingest:dry -- ./BASE_CLIENTES.xlsx    (solo reporta, no sube)
// ============================================================
import * as XLSX from 'xlsx'
import { segmentoDe, esGestionado, normalizarNit, type ClienteRow } from '../src/lib/segmentos'
import { supabaseServer } from '../src/lib/supabase'

async function main() {
  const args = process.argv.slice(2)
  const dry  = args.includes('--dry')
  const file = args.find((a) => !a.startsWith('--'))
  if (!file) { console.error('Uso: npm run ingest -- <archivo.xlsx> [--dry]'); process.exit(1) }

  const wb = XLSX.readFile(file)
  const rows = XLSX.utils.sheet_to_json<ClienteRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' })

  const vistos = new Set<string>()
  const clientes: Record<string, unknown>[] = []
  const conteo: Record<string, number> = {}
  let duplicados = 0, sinNit = 0

  for (const r of rows) {
    const nit = normalizarNit(r.ID_IDENTIFICACION)
    if (!nit)            { sinNit++; continue }
    if (vistos.has(nit)) { duplicados++; continue }   // dedupe (la base trae ~11 NITs repetidos)
    vistos.add(nit)

    const segmento = segmentoDe(r)
    conteo[segmento] = (conteo[segmento] || 0) + 1
    clientes.push({
      nit,
      nombre:       String(r.NOMBRE_CUENTA || '').trim(),
      propietario:  String(r.PROPIETARIO_CUENTA || '').trim(),
      segmento_raw: String(r.SEGMENTO || '').trim(),
      segmento_uen: String(r.SEGMENTO_UEN || '').trim(),
      mesa:         String(r.MESA || '').trim(),
      segmento,
      gestionado:   esGestionado(segmento),
    })
  }

  console.log(`Filas: ${rows.length} | Únicos: ${clientes.length} | Duplicados: ${duplicados} | Sin NIT: ${sinNit}`)
  console.log('Distribución por segmento:', conteo)

  if (dry) { console.log('(--dry) No se subió nada.'); return }

  const sb = supabaseServer()
  for (let i = 0; i < clientes.length; i += 500) {
    const lote = clientes.slice(i, i + 500)
    const { error } = await sb.from('clientes').upsert(lote, { onConflict: 'nit' })
    if (error) { console.error('Error en lote', i, '→', error.message); process.exit(1) }
    console.log(`  subidos ${Math.min(i + 500, clientes.length)}/${clientes.length}`)
  }
  console.log('Ingesta completa.')
}

main().catch((e) => { console.error(e); process.exit(1) })
