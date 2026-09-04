import { NextResponse } from 'next/server'
import { sfLogin, sfDescribe, SF_CFG } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Diagnóstico: lista los campos del objeto Case en Salesforce cuyo nombre o
// etiqueta se parece a ciudad / dirección / localidad, para saber qué poner en
// SF_CITY_FIELD, SF_CITY_NAME_FIELD y SF_ADDRESS_FIELD sin adivinar.
//   curl -H "Authorization: Bearer <CRON_SECRET>" .../api/sf-fields
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

const PATRON = /(ciudad|direccion|dirección|localidad|barrio|city|address|street|ubicac|municipio|departamento|state)/i

async function run(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  const sobject = new URL(req.url).searchParams.get('sobject') || 'Case'
  try {
    const session = await sfLogin()
    const desc = await sfDescribe(session, sobject)
    const candidatos = (desc.fields || [])
      .filter((f: any) => PATRON.test(f.name) || PATRON.test(f.label))
      .map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        referenceTo: f.referenceTo?.length ? f.referenceTo : undefined,
        relationshipName: f.relationshipName || undefined,
      }))
    return NextResponse.json({
      ok: true,
      sobject,
      configActual: {
        SF_CITY_FIELD: SF_CFG.CITY_FIELD,
        SF_CITY_NAME_FIELD: SF_CFG.CITY_NAME_FIELD,
        SF_ADDRESS_FIELD: SF_CFG.ADDRESS_FIELD || '(sin configurar)',
      },
      candidatos,
      pista: 'Si el campo de ciudad es lookup (type=reference), usa su relationshipName + ".Name" en SF_CITY_NAME_FIELD. Si hay un campo de dirección de texto, ponlo en SF_ADDRESS_FIELD.',
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request)  { return run(req) }
export async function POST(req: Request) { return run(req) }
