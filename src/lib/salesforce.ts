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

/** Describe un sObject (metadatos de campos). Sirve para diagnóstico de nombres. */
export async function sfDescribe(session: SFSession, sobject = 'Case'): Promise<any> {
  const url = `${session.instanceUrl}/services/data/v59.0/sobjects/${sobject}/describe`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.sessionId}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`SF describe error ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Configuración de campos (nombres API reales van en .env) ──
export const SF_CFG = {
  NIT_FIELD:   process.env.SF_NIT_FIELD   || 'AccountNumber__c',      // "Nit Cliente" (campo del Caso)
  RECORD_TYPE: process.env.SF_RECORD_TYPE || 'SOPORTE TECNICO',
  CITY_FIELD:  process.env.SF_CITY_FIELD  || 'Ciudad_Instalacion__c', // "Ciudad Instalacion"
  // Cuando la ciudad es un lookup a otro objeto, el campo directo devuelve el
  // Id (p.ej. "a014000000QybGpAAJ") y el mapa no puede ubicar nada. Con este
  // campo pedimos el nombre legible por la relación (…__r.Name). Se autodetecta
  // desde CITY_FIELD si no se define en .env; déjalo vacío si la ciudad ya es texto.
  CITY_NAME_FIELD: process.env.SF_CITY_NAME_FIELD ?? deriveRelationshipName(process.env.SF_CITY_FIELD || 'Ciudad_Instalacion__c'),
  STATE_FIELD: process.env.SF_STATE_FIELD || '',
  // Campo de dirección del Caso. Se usa SOLO para geolocalizar (cruzar el texto
  // con localidades/ciudades, como el script de GAS); no se guarda crudo.
  // Confirmado por diagnóstico: Direccion_Instalacion__c. Pon '' para desactivar.
  ADDRESS_FIELD: process.env.SF_ADDRESS_FIELD ?? 'Direccion_Instalacion__c',
  WINDOW_DAYS: parseInt(process.env.SF_WINDOW_DAYS || '60', 10),
}

function sanitizeField(name: string): string {
  // Solo permitimos identificadores de campo válidos (evita inyección en SOQL).
  return /^[A-Za-z0-9_.]+$/.test(name) ? name : ''
}

/**
 * Deriva la ruta de relación …__r.Name a partir de un campo lookup …__c.
 * Ej: 'Ciudad_Instalacion__c' → 'Ciudad_Instalacion__r.Name'.
 * Si el campo no es un lookup custom (__c) devuelve '' (no se pide el nombre).
 */
export function deriveRelationshipName(field: string): string {
  const f = String(field || '').trim()
  return /__c$/.test(f) ? `${f.replace(/__c$/, '__r')}.Name` : ''
}

/** true si el valor parece un Id de Salesforce (15 o 18 caracteres alfanuméricos). */
export function looksLikeSalesforceId(v: unknown): boolean {
  return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(String(v ?? '').trim())
}

/**
 * SOQL de casos con las 3 reglas: SOPORTE TECNICO, sin Cancelado, todo por NIT.
 * Trae abiertos + cerrados dentro de la ventana. El owner NO se filtra.
 */
export function buildCasesSOQL(): string {
  const nit  = sanitizeField(SF_CFG.NIT_FIELD)  || 'AccountNumber__c'
  const city = sanitizeField(SF_CFG.CITY_FIELD) || 'Ciudad_Instalacion__c'
  const cityName = sanitizeField(SF_CFG.CITY_NAME_FIELD) // ruta …__r.Name (nombre legible)
  const days = SF_CFG.WINDOW_DAYS
  // NIT y ciudad son campos DIRECTOS del Caso (AccountNumber__c = "Nit Cliente").
  // Si la ciudad es un lookup, pedimos también el nombre por la relación para no
  // guardar el Id crudo en el mapa.
  const address = sanitizeField(SF_CFG.ADDRESS_FIELD) // dirección (solo para geolocalizar)
  const cols = [
    'Id', 'CaseNumber', 'Status', 'IsClosed', 'CreatedDate', 'ClosedDate',
    'RecordType.Name', 'Account.Name', nit, city,
    ...(cityName ? [cityName] : []),
    ...(address ? [address] : []),
    'Tipologia__c', 'TipoCaso__c', 'Categoria_legado__c',
    'FechaInicioAfectacion__c', 'FechaFinAfectacion__c',
  ].join(', ')

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

/**
 * Devuelve el nombre legible de la ciudad de un registro de Caso.
 * Prioriza el nombre por la relación (…__r.Name); si no existe, usa el campo
 * directo solo cuando NO parece un Id de Salesforce (evita pintar "a014…" ).
 */
export function cityNameFromRecord(record: any): string {
  // 1) Nombre por la relación (p.ej. Ciudad_Instalacion__r.Name)
  const relField = SF_CFG.CITY_NAME_FIELD // 'Ciudad_Instalacion__r.Name'
  if (relField) {
    const [rel, prop = 'Name'] = relField.split('.')
    const relName = record?.[rel]?.[prop]
    if (relName) return String(relName).trim()
  }
  // 2) Campo directo, solo si es texto legible (no un Id)
  const direct = record?.[SF_CFG.CITY_FIELD]
  if (direct != null && !looksLikeSalesforceId(direct)) return String(direct).trim()
  return ''
}

/**
 * Devuelve el texto de dirección del Caso (si SF_ADDRESS_FIELD está configurado).
 * Soporta campos directos y de relación (…__r.Campo). Solo se usa para
 * geolocalizar por texto; nunca se guarda crudo si parece un Id.
 */
export function addressFromRecord(record: any): string {
  const field = SF_CFG.ADDRESS_FIELD
  if (!field) return ''
  const val = field.includes('.')
    ? field.split('.').reduce((o: any, k: string) => o?.[k], record)
    : record?.[field]
  if (val == null || looksLikeSalesforceId(val)) return ''
  return String(val).trim()
}

export function fmtLocal(d: string | Date | null): string {
  if (!d) return ''
  return new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
}
