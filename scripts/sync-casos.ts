// ============================================================
//  Sync de casos: Salesforce → Supabase.casos
//  Trae SOLO SOPORTE TECNICO, sin Cancelado, todo por NIT (sin owner).
//  Uso:  npm run sync
//  (En producción lo dispara el cron de Vercel vía /api/sync.)
// ============================================================
import { syncCasos } from '../src/lib/sync'

async function main() {
  const { count, soql, geocodificados } = await syncCasos()
  console.log('SOQL:', soql.replace(/\s+/g, ' ').trim())
  console.log(`Sync completo: ${count} casos · ${geocodificados} direcciones geocodificadas (nuevas).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
