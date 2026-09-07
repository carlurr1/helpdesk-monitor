'use client'
import { useEffect, useState } from 'react'

const KEY = 'etb_monitor_auth'
const CODE = '2312'

// Puerta de acceso simple por código. NO es autenticación real (el código vive
// en el cliente); es un candado de acceso para la vista. La lógica y las APIs no
// cambian.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    try { setOk(localStorage.getItem(KEY) === CODE) } catch { setOk(false) }
  }, [])

  function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim() === CODE) {
      try { localStorage.setItem(KEY, CODE) } catch {}
      setOk(true)
    } else { setError(true); setCode('') }
  }

  if (ok === null) return null
  if (ok) return <>{children}</>

  return (
    <div className="grid min-h-screen place-items-center p-6" style={{ background: 'radial-gradient(1200px 600px at 20% -10%, #16233d 0%, #0c1322 55%, #080d18 100%)' }}>
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'linear-gradient(135deg,#1f7ad1,#0b5aa5)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 5-7" /></svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-white">Monitor Help Desk</div>
            <div className="text-xs font-medium tracking-wide text-slate-400">ETB · Centro de operaciones</div>
          </div>
        </div>

        <form onSubmit={entrar} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <h1 className="text-lg font-bold text-white">Acceso restringido</h1>
          <p className="mt-1 text-[13px] text-slate-400">Ingresa el código de seguridad para continuar.</p>
          <input
            autoFocus value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(false) }}
            inputMode="numeric" maxLength={8} placeholder="• • • •"
            className="mt-5 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-white outline-none placeholder:text-slate-600 focus:border-sky-500"
          />
          {error && <p className="mt-2 text-[13px] font-medium text-rose-400">Código incorrecto.</p>}
          <button type="submit" className="mt-5 w-full rounded-lg bg-gradient-to-br from-sky-500 to-[#0b5aa5] py-3 text-sm font-bold text-white transition hover:opacity-95">
            Ingresar
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-slate-600">Uso interno · Datos de Salesforce protegidos</p>
      </div>
    </div>
  )
}
