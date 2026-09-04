'use client'
import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { segmentoDe, esGestionado, normalizarNit, type ClienteRow } from '@/lib/segmentos'

interface Health {
  listo: boolean
  env: Record<string, boolean>
  db: { clientes: number | null; casos: number | null; error: string | null }
}

export default function Admin() {
  const [secret, setSecret] = useState('')
  const [health, setHealth] = useState<Health | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const push = (m: string) => setLog((l) => [...l, m])
  const cargarHealth = () => fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {})
  useEffect(() => { cargarHealth() }, [])

  async function subirClientes(file: File) {
    if (!secret) { push('⚠️ Escribe la clave de admin primero.'); return }
    setBusy(true)
    try {
      push(`Leyendo ${file.name}…`)
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json<ClienteRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' })

      const vistos = new Set<string>()
      const clientes: Record<string, unknown>[] = []
      for (const r of rows) {
        const nit = normalizarNit(r.ID_IDENTIFICACION)
        if (!nit || vistos.has(nit)) continue
        vistos.add(nit)
        const segmento = segmentoDe(r)
        clientes.push({
          nit,
          nombre: String(r.NOMBRE_CUENTA || '').trim(),
          propietario: String(r.PROPIETARIO_CUENTA || '').trim(),
          segmento_raw: String(r.SEGMENTO || '').trim(),
          segmento_uen: String(r.SEGMENTO_UEN || '').trim(),
          mesa: String(r.MESA || '').trim(),
          segmento,
          gestionado: esGestionado(segmento),
        })
      }
      push(`${clientes.length.toLocaleString('es-CO')} clientes únicos. Subiendo…`)

      const B = 2000
      for (let i = 0; i < clientes.length; i += B) {
        const lote = clientes.slice(i, i + B)
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ clientes: lote }),
        })
        const j = await res.json()
        if (!j.ok) throw new Error(j.error || 'Error subiendo')
        push(`  ${Math.min(i + B, clientes.length).toLocaleString('es-CO')} / ${clientes.length.toLocaleString('es-CO')}`)
      }
      push('✅ Clientes cargados.')
      cargarHealth()
    } catch (e: any) {
      push('❌ ' + (e?.message || e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function sincronizar() {
    if (!secret) { push('⚠️ Escribe la clave de admin primero.'); return }
    setBusy(true)
    push('Sincronizando casos desde Salesforce… (puede tardar unos segundos)')
    try {
      const res = await fetch('/api/sync', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      push(`✅ ${Number(j.count).toLocaleString('es-CO')} casos sincronizados${j.geocodificados ? ` · ${j.geocodificados} direcciones geocodificadas (nuevas)` : ''}.`)
      if (j.geocodificados >= 45) push('ℹ️ Se alcanzó el tope de geocodificación por corrida; vuelve a sincronizar para completar el resto (usa la caché, es rápido).')
      cargarHealth()
    } catch (e: any) {
      push('❌ ' + (e?.message || e) + '  — si dice timeout/504, en plan Hobby el sync se corta a los 10s; ahí toca Vercel Pro.')
    } finally {
      setBusy(false)
    }
  }

  async function diagnosticarCampos() {
    if (!secret) { push('⚠️ Escribe la clave de admin primero.'); return }
    setBusy(true)
    push('Consultando nombres de campos en Salesforce (Case)…')
    try {
      const res = await fetch('/api/sf-fields', { headers: { Authorization: `Bearer ${secret}` } })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      push(`Config actual → ciudad: ${j.configActual.SF_CITY_FIELD} · nombre: ${j.configActual.SF_CITY_NAME_FIELD || '(vacío)'} · dirección: ${j.configActual.SF_ADDRESS_FIELD}`)
      if (!j.candidatos.length) push('No se hallaron campos con nombre de ciudad/dirección. Revisa permisos del usuario SF.')
      j.candidatos.forEach((c: any) => {
        const ref = c.type === 'reference' ? ` → lookup a ${(c.referenceTo || []).join('/')}; usa ${c.relationshipName}.Name` : ''
        push(`  • ${c.name}  [${c.type}]  "${c.label}"${ref}`)
      })
      push('👉 Pásame estos nombres y configuro SF_CITY_FIELD / SF_CITY_NAME_FIELD / SF_ADDRESS_FIELD.')
    } catch (e: any) {
      push('❌ ' + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function verMuestra() {
    if (!secret) { push('⚠️ Escribe la clave de admin primero.'); return }
    setBusy(true)
    push('Trayendo datos de ejemplo (ciudad + dirección) desde Salesforce…')
    try {
      const res = await fetch('/api/sf-sample?n=15', { headers: { Authorization: `Bearer ${secret}` } })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      push(`Campos → ciudad: ${j.campos.cityName || j.campos.city} · dirección: ${j.campos.addr}`)
      push(`Ubicados ${j.ubicados}/${j.totalMuestra} (sin ubicar: ${j.sinUbicar})`)
      j.muestras.forEach((m: any) => {
        const geo = m.ubicado ? `✅ ${m.ubicado.via}` : '❌ sin ubicar'
        push(`  ${m.caso} | ciudad="${m.ciudadNombre ?? '∅'}" | dir="${m.direccion ?? '∅'}" | ${geo}`)
      })
      push('👉 Copiame estas líneas y ajusto el catálogo de geo para que ubiquen.')
    } catch (e: any) {
      push('❌ ' + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const chip = (ok: boolean) => (
    <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + (ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
      {ok ? 'OK' : 'falta'}
    </span>
  )

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <a href="/" className="text-sm text-brand hover:underline">← Volver al tablero</a>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-800">Configuración / Carga de datos</h1>
        <p className="mt-1 text-sm text-slate-500">Todo desde el navegador — sin terminal.</p>
      </header>

      {/* Estado */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Estado</h2>
        {!health ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(health.env).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 text-slate-600">{k} {chip(v)}</span>
              ))}
            </div>
            <div className="pt-1 text-slate-700">
              Clientes: <strong>{health.db.clientes ?? '—'}</strong> · Casos: <strong>{health.db.casos ?? '—'}</strong>
              {health.db.error ? <span className="text-rose-600"> · {health.db.error}</span> : null}
            </div>
          </div>
        )}
      </section>

      {/* Clave */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">1. Clave de admin</label>
        <p className="mb-2 text-xs text-slate-400">La misma que pusiste en Vercel como <code>CRON_SECRET</code>.</p>
        <input
          type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
          placeholder="pega aquí tu CRON_SECRET"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </section>

      {/* Clientes */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">2. Cargar base de clientes (Excel)</h2>
        <p className="mb-3 text-xs text-slate-400">Sube el archivo <code>BASE_CLIENTES.xlsx</code>. Se procesa en tu navegador y se guardan los NITs con su segmento.</p>
        <input
          ref={fileRef} type="file" accept=".xlsx,.xls" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirClientes(f) }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90 disabled:opacity-50"
        />
      </section>

      {/* Casos */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">3. Traer casos de Salesforce</h2>
        <p className="mb-3 text-xs text-slate-400">Consulta SF (solo SOPORTE TECNICO, sin Cancelado) y guarda los casos.</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={sincronizar} disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Trabajando…' : 'Sincronizar casos ahora'}
          </button>
          <button
            onClick={diagnosticarCampos} disabled={busy}
            title="Muestra los nombres reales de los campos de ciudad/dirección en Salesforce"
            className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            Diagnóstico de campos SF
          </button>
          <button
            onClick={verMuestra} disabled={busy}
            title="Muestra los valores reales de ciudad y dirección de unos casos y si se ubican en el mapa"
            className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            Ver datos de ejemplo
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Si la ciudad sale como un Id (ej. <code>a014000000QybGpAAJ</code>), usa <strong>Diagnóstico de campos SF</strong> para ver el nombre real del campo y su dirección.</p>
      </section>

      {/* Log */}
      {log.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 shadow-sm">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </section>
      )}
    </main>
  )
}
