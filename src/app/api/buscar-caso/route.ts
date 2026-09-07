import { NextResponse } from 'next/server'
import { sfLogin, sfQuery, SF_CFG } from '@/lib/salesforce'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Diagnóstico: busca UN caso por número en Salesforce (en vivo) y en Supabase,
// para entender por qué no aparece en el tablero. Protegido con CRON_SECRET
// (header Authorization: Bearer … o ?key=…).
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if ((req.headers.get('authorization') || '') === `Bearer ${secret}`) return true
  return new URL(req.url).searchParams.get('key') === secret
}

async function run(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  const numero = (new URL(req.url).searchParams.get('numero') || '').replace(/[^0-9A-Za-z-]/g, '')
  if (!numero) return NextResponse.json({ ok: false, error: 'Falta ?numero=' }, { status: 400 })

  try {
    // 1) Salesforce en vivo (todos los campos que deciden si entra al monitor).
    const s = await sfLogin()
    const soql = `SELECT Id, CaseNumber, Status, IsClosed, RecordType.Name, Account.Name,
      ${SF_CFG.NIT_FIELD}, ${SF_CFG.EXTID_FIELD || 'Id'}, CreatedDate, LastModifiedDate
      FROM Case WHERE CaseNumber = '${numero}'`
    const q = await sfQuery(s, soql)
    const sf = (q.records || []).map((r: any) => ({
      caso: r.CaseNumber, estado: r.Status, cerrado: r.IsClosed,
      recordType: r.RecordType && r.RecordType.Name,
      cuenta: r.Account && r.Account.Name,
      nit: r[SF_CFG.NIT_FIELD],
      creado: r.CreatedDate, modificado: r.LastModifiedDate,
    }))

    // 2) Supabase (vista segmentada).
    const { data } = await supabaseServer().from('casos_segmentados')
      .select('numero, estado, abierto, segmento, cuenta_nombre, nit, ciudad, sincronizado_en').eq('numero', numero)

    // Veredicto
    const reglas = SF_CFG.RECORD_TYPE
    let motivo = 'Debería aparecer.'
    if (!sf.length) motivo = 'No existe ese CaseNumber en Salesforce (o sin permiso).'
    else {
      const c = sf[0]
      if (c.recordType !== reglas) motivo = `RecordType es "${c.recordType}", no "${reglas}" → el monitor solo trae ${reglas}.`
      else if (c.estado === 'Cancelado') motivo = 'Está Cancelado → excluido por regla.'
      else if (/ENTERATE/i.test(String(c.cuenta || ''))) motivo = 'La cuenta contiene "Enterate" → excluida (ETB EnterateConETB).'
      else if (!data?.length) motivo = 'Cumple las reglas pero NO está en Supabase → falta sincronizar (o el sync incremental no lo tomó).'
      else motivo = `Está en Supabase como segmento "${data[0].segmento}", abierto=${data[0].abierto}. Si no lo ves, revisa el segmento/filtros seleccionados.`
    }

    return NextResponse.json({ ok: true, numero, salesforce: sf, supabase: data ?? [], regla: reglas, motivo })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }
