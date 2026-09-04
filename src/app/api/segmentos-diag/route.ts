import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { SEGMENTOS } from '@/lib/segmentos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Diagnóstico de segmentación: por qué un segmento (p.ej. Mayoristas/Élite) sale
// en 0. Muestra la distribución de MESA y de segmento en la base de clientes, y
// cuántos CASOS hay por segmento (cruce por NIT en la vista).
//   curl -H "Authorization: Bearer <CRON_SECRET>" .../api/segmentos-diag
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

async function contarPor(sb: any, tabla: string, campo: string): Promise<Record<string, number>> {
  // Trae solo el campo y cuenta en memoria (la base cabe: ~18k filas).
  const out: Record<string, number> = {}
  const PAG = 1000
  for (let desde = 0; ; desde += PAG) {
    const { data, error } = await sb.from(tabla).select(campo).range(desde, desde + PAG - 1)
    if (error) throw new Error(`${tabla}.${campo}: ${error.message}`)
    if (!data?.length) break
    for (const r of data) {
      const k = (r[campo] ?? '∅') === '' ? '∅' : String(r[campo] ?? '∅')
      out[k] = (out[k] || 0) + 1
    }
    if (data.length < PAG) break
  }
  return out
}

async function run(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    const sb = supabaseServer()
    const [mesa, segClientes] = await Promise.all([
      contarPor(sb, 'clientes', 'mesa'),
      contarPor(sb, 'clientes', 'segmento'),
    ])
    // Casos por segmento (desde la vista, que ya cruza por NIT).
    const casosSeg = await contarPor(sb, 'casos_segmentados', 'segmento')

    const orden = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))

    return NextResponse.json({
      ok: true,
      segmentosEsperados: SEGMENTOS,
      clientesPorMesa: orden(mesa),
      clientesPorSegmento: orden(segClientes),
      casosPorSegmento: orden(casosSeg),
      pista: 'Si un segmento tiene clientes pero 0 casos → los NITs de esos clientes no cruzan con los casos de SF (revisar NIT_OVERRIDES). Si no aparece en clientesPorSegmento → la MESA de esos clientes no coincide con el mapeo (ver clientesPorMesa para el texto real).',
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request)  { return run(req) }
export async function POST(req: Request) { return run(req) }
