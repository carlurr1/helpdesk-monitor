import { NextResponse } from 'next/server'
import { sfLogin, sfQuery, SF_CFG } from '@/lib/salesforce'
import { resolverGeo, geolocalizarTexto } from '@/lib/geo'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Diagnóstico: muestra los valores REALES de ciudad y dirección de unos casos,
// y si mi geolocalizador los ubica. Sirve para calibrar el cruce por dirección
// sin adivinar el formato. Protegido con CRON_SECRET.
//   curl -H "Authorization: Bearer <CRON_SECRET>" .../api/sf-sample
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function run(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  const n = Math.min(30, Math.max(1, parseInt(new URL(req.url).searchParams.get('n') || '15', 10)))
  const city = SF_CFG.CITY_FIELD
  const cityName = SF_CFG.CITY_NAME_FIELD
  const addr = SF_CFG.ADDRESS_FIELD
  try {
    const session = await sfLogin()
    const cols = ['Id', 'CaseNumber', city, ...(cityName ? [cityName] : []), ...(addr ? [addr] : [])].join(', ')
    const soql = `SELECT ${cols} FROM Case WHERE RecordType.Name = '${SF_CFG.RECORD_TYPE.replace(/'/g, "\\'")}' AND IsClosed = false ORDER BY CreatedDate DESC LIMIT ${n}`
    const data = await sfQuery(session, soql)
    const [rel, prop = 'Name'] = (cityName || '').split('.')
    const muestras = (data.records || []).map((r: any) => {
      const nombre = rel ? r?.[rel]?.[prop] ?? null : null
      const direccion = addr ? (addr.includes('.') ? addr.split('.').reduce((o: any, k: string) => o?.[k], r) : r?.[addr]) ?? null : null
      let geo = resolverGeo({ ciudad: nombre, localidad: nombre })
      let via = geo ? `catálogo:${geo.fuente}` : null
      if (!geo) { const t = geolocalizarTexto(nombre, direccion); if (t) { geo = t.geo; via = `texto→${t.nombre}` } }
      return {
        caso: r.CaseNumber,
        ciudadId: r[city] ?? null,
        ciudadNombre: nombre,
        direccion,
        ubicado: geo ? { lat: geo.lat, lng: geo.lng, via } : null,
      }
    })
    const ubicados = muestras.filter((m: any) => m.ubicado).length
    return NextResponse.json({
      ok: true,
      campos: { city, cityName, addr: addr || '(sin configurar)' },
      totalMuestra: muestras.length,
      ubicados,
      sinUbicar: muestras.length - ubicados,
      muestras,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request)  { return run(req) }
export async function POST(req: Request) { return run(req) }
