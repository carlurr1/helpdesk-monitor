import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Diagnóstico del cruce por Identificador Externo (Distrito/Élite).
// Revela en qué eslabón se corta: ¿los casos tienen nit_ext? ¿la base tiene esos
// identificadores? ¿la vista los cruza?  Protegido con CRON_SECRET.
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function run(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  try {
    const sb = supabaseServer()

    // ¿Existe la columna nit_ext en la vista? (si no, la vista no se recreó)
    const probe = await sb.from('casos_segmentados').select('nit_ext').limit(1)
    const hayColumna = !probe.error
    if (!hayColumna) {
      return NextResponse.json({
        ok: true, paso: 'FALTA_COLUMNA',
        detalle: 'La vista casos_segmentados no tiene la columna nit_ext. Corre el SQL (alter table + drop/create view).',
        errorSql: probe.error?.message,
      })
    }

    // Casos con nit_ext (identificador externo traído de SF)
    const totalCasos = await sb.from('casos_segmentados').select('id', { count: 'exact', head: true })
    const conExt = await sb.from('casos_segmentados').select('id', { count: 'exact', head: true }).not('nit_ext', 'is', null)

    // Muestras de casos que traen nit_ext
    const muestraCasos = await sb.from('casos_segmentados')
      .select('numero, nit, nit_ext, segmento, cuenta_nombre').not('nit_ext', 'is', null).limit(15)

    // ¿Esos identificadores externos existen en la base de clientes?
    const extIds = [...new Set((muestraCasos.data ?? []).map((r: any) => r.nit_ext).filter(Boolean))]
    let clientesMatch: any[] = []
    if (extIds.length) {
      const q = await sb.from('clientes').select('nit, segmento, nombre').in('nit', extIds as string[])
      clientesMatch = q.data ?? []
    }
    const setMatch = new Set(clientesMatch.map((c) => c.nit))

    // Clientes cuyo NIT parece un identificador externo (más de 10 dígitos)
    const largos = await sb.from('clientes').select('nit, segmento', { count: 'exact' })
      .filter('nit', 'gte', '10000000000').limit(10)

    return NextResponse.json({
      ok: true,
      paso: (conExt.count ?? 0) === 0 ? 'CASOS_SIN_NIT_EXT' : (clientesMatch.length === 0 ? 'BASE_SIN_EXTIDS' : 'OK_REVISAR'),
      casos: { total: totalCasos.count ?? 0, conNitExt: conExt.count ?? 0 },
      clientesConIdLargo: largos.count ?? 0,
      ejemplos: (muestraCasos.data ?? []).map((r: any) => ({
        caso: r.numero, nit: r.nit, nit_ext: r.nit_ext, segmento: r.segmento,
        cuenta: r.cuenta_nombre, extIdEnBase: setMatch.has(r.nit_ext),
      })),
      pistas: {
        CASOS_SIN_NIT_EXT: 'Los casos no traen identificador externo. ¿Sincronizaste DESPUÉS del último deploy? ¿La cuenta del caso tiene External_Id__c en SF?',
        BASE_SIN_EXTIDS: 'Los casos SÍ traen nit_ext, pero esos valores no están en la base de clientes. Sube la base NUEVA con el identificador externo en la columna ID_IDENTIFICACION.',
        OK_REVISAR: 'Hay match. Si aún ves mal el segmento, revisa que la vista tenga los dos joins (cle por nit_ext, cln por nit).',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }
