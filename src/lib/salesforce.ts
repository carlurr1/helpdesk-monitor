// ─── Cliente Salesforce ─────────────────────────────────────
// Login por SOAP (usuario + contraseña + token) y consulta por REST.
// Los nombres de campo API se configuran por variable de entorno para no
// tocar código si en Salesforce se llaman distinto.

interface SFSession {
  sessionId: string
  instanceUrl: string
}

export async function sfLogin(): Promise<SFSession> {
  const username = process.env.SF_USERNAME
  const password = process.env.SF_PASSWORD
  const token    = process.env.SF_TOKEN
  const domain   = process.env.SF_DOMAIN || 'login'

  if (!username || !password || !token) {
    throw new Error('Credenciales SF no configuradas en variables de entorno.')
  }

  const loginUrl = `https://${domain}.salesforce.com/services/Soap/u/59.0`
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<env:Body>
<n1:login xmlns:n1="urn:partner.soap.sforce.com">
  <n1:username>${username}</n1:username>
  <n1:password>${password}${token}</n1:password>
</n1:login>
</env:Body>
</env:Envelope>`

  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', SOAPAction: 'login' },
    body: soapBody,
  })

  const xml = await res.text()

  if (xml.includes('INVALID_LOGIN') || xml.includes('faultstring')) {
    const match = xml.match(/<faultstring>(.*?)<\/faultstring>/)
    throw new Error(`Login SF fallido: ${match?.[1] ?? 'credenciales incorrectas'}`)
  }

  const sessionMatch = xml.match(/<sessionId>(.*?)<\/sessionId>/)
  const urlMatch     = xml.match(/<serverUrl>(.*?)<\/serverUrl>/)
  if (!sessionMatch || !urlMatch) throw new Error('No se pudo extraer sesión de Salesforce')

  return {
    sessionId:   sessionMatch[1],
    instanceUrl: urlMatch[1].split('/services/Soap/')[0],
  }
}

export async function sfQuery(
  session: SFSession,
  soql: string
): Promise<{ records: any[]; totalSize: number; done: boolean; nextRecordsUrl?: string }> {
  const url = `${session.instanceUrl}/services/data/v59.0/query/?q=${encodeURIComponent(soql)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.sessionId}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`SF query error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.errorCode) throw new Error(`SF error [${data.errorCode}]: ${data.message}`)
  return data
}

/** Recorre la paginación de Salesforce y devuelve todos los registros. */
export async function sfQueryAll(session: SFSession, soql: string): Promise<any[]> {
  let data = await sfQuery(session, soql)
  const records = [...(data.records || [])]
  while (!data.done && data.nextRecordsUrl) {
    const res = await fetch(`${session.instanceUrl}${data.nextRecordsUrl}`, {
      headers: { Authorization: `Bearer ${session.sessionId}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`SF query-more error ${res.status}: ${await res.text()}`)
    data = await res.json()
    records.push(...(data.records || []))
  }
  return records
}

// ── Configuración de campos (nombres API reales van en .env) ──
export const SF_CFG = {
  NIT_FIELD:   process.env.SF_NIT_FIELD   || 'Numero_de_Documento__c',
  RECORD_TYPE: process.env.SF_RECORD_TYPE || 'SOPORTE TECNICO',
  CITY_FIELD:  process.env.SF_CITY_FIELD  || 'Ciudad_Instalacion__c',
  STATE_FIELD: process.env.SF_STATE_FIELD || '',
  WINDOW_DAYS: parseInt(process.env.SF_WINDOW_DAYS || '60', 10),
}

function sanitizeField(name: string): string {
  // Solo permitimos identificadores de campo válidos (evita inyección en SOQL).
  return /^[A-Za-z0-9_.]+$/.test(name) ? name : ''
}

/**
 * SOQL de casos con las 3 reglas: SOPORTE TECNICO, sin Cancelado, todo por NIT.
 * Trae abiertos + cerrados dentro de la ventana. El owner NO se filtra.
 */
export function buildCasesSOQL(): string {
  const nit  = sanitizeField(SF_CFG.NIT_FIELD)
  const city = sanitizeField(SF_CFG.CITY_FIELD)
  const days = SF_CFG.WINDOW_DAYS
  const cols = [
    'Id', 'CaseNumber', 'Status', 'IsClosed', 'CreatedDate', 'ClosedDate',
    'RecordType.Name', 'Account.Name',
    nit  ? `Account.${nit}` : null,
    city ? city : null,
  ].filter(Boolean).join(', ')

  return `SELECT ${cols}
    FROM Case
    WHERE RecordType.Name = '${SF_CFG.RECORD_TYPE.replace(/'/g, "\\'")}'
      AND Status != 'Cancelado'
      AND (IsClosed = false OR ClosedDate = LAST_N_DAYS:${days})
    ORDER BY CreatedDate DESC`
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function safeValue(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

export function fmtLocal(d: string | Date | null): string {
  if (!d) return ''
  return new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
}
