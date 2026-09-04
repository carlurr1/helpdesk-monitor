// ============================================================
//  Geo de Colombia — resuelve ciudad/departamento → {lat,lng}
//  BLINDADO: si no encuentra la ciudad, devuelve null. El caso NO se
//  descarta ni rompe nada: sigue contando en KPIs, tablas y filtros;
//  simplemente no se pinta en el mapa (o cae en "Sin ubicación").
// ============================================================

export interface Geo {
  lat: number
  lng: number
  fuente: 'localidad' | 'ciudad' | 'departamento'
}

function norm(s: unknown): string {
  const t = String(s ?? '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes (marcas combinantes)
    .replace(/[^A-Z0-9 ]/g, ' ') // puntuación → espacio (no pega palabras: "ARANDA-COMCEL" → "ARANDA COMCEL")
    .replace(/\s+/g, ' ')
    .trim()
  // "BOGOTA, D.C." / "BOGOTA D C" / "BOGOTA DC" → "BOGOTA"
  return t.replace(/\bBOGOTA D C\b/g, 'BOGOTA').replace(/\bBOGOTA DC\b/g, 'BOGOTA')
}

/**
 * Extrae coordenadas embebidas en un texto (algunas direcciones traen la
 * geolocalización dentro): decimales "3.876978, -73.764934" o grados/minutos/
 * segundos "4°10'16\"N 74°10'17\"". Devuelve null si no hay o si caen fuera de
 * Colombia. En Colombia la longitud siempre es Oeste (negativa).
 */
export function extraerCoordenadas(texto: unknown): { lat: number; lng: number } | null {
  const s = String(texto ?? '')
  // 1) Decimales
  const dec = s.match(/(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/)
  if (dec) {
    const g = validarCoord(parseFloat(dec[1]), parseFloat(dec[2]))
    if (g) return g
  }
  // 2) Grados/minutos/segundos
  const dms = [...s.matchAll(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)?\s*["″]?\s*([NSEWO])?/gi)]
  if (dms.length >= 2) {
    const a = dmsAdecimal(dms[0]), b = dmsAdecimal(dms[1])
    if (a && b) {
      const lat = a.dir === 'S' ? -a.val : a.val
      const lng = -Math.abs(b.val) // Colombia: siempre Oeste
      const g = validarCoord(lat, lng)
      if (g) return g
    }
  }
  return null
}

function dmsAdecimal(m: RegExpMatchArray): { val: number; dir: string } | null {
  const deg = parseFloat(m[1]); if (!Number.isFinite(deg)) return null
  const min = parseFloat(m[2] || '0') || 0
  const sec = parseFloat(m[3] || '0') || 0
  return { val: deg + min / 60 + sec / 3600, dir: (m[4] || '').toUpperCase() }
}

function validarCoord(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const dentro = (la: number, ln: number) => la >= -5 && la <= 15 && ln >= -82 && ln <= -66
  if (dentro(lat, lng)) return { lat, lng }
  if (dentro(lng, lat)) return { lat: lng, lng: lat } // venían invertidas
  return null
}

type LatLng = [number, number]

// Centroides por departamento (fallback nacional). [lat, lng]
const DEPARTAMENTOS: Record<string, LatLng> = {
  'AMAZONAS':[-4.2153,-69.9406],'ANTIOQUIA':[6.2518,-75.5636],'ARAUCA':[7.0847,-70.7591],
  'ATLANTICO':[10.9685,-74.7813],'BOLIVAR':[10.3910,-75.4794],'BOYACA':[5.5353,-73.3678],
  'CALDAS':[5.0703,-75.5138],'CAQUETA':[1.6144,-75.6062],'CASANARE':[5.3378,-72.3959],
  'CAUCA':[2.4448,-76.6147],'CESAR':[10.4631,-73.2532],'CHOCO':[5.6919,-76.6583],
  'CORDOBA':[8.7479,-75.8814],'CUNDINAMARCA':[4.6486,-74.2479],'GUAINIA':[3.8653,-67.9239],
  'GUAVIARE':[2.5709,-72.6459],'HUILA':[2.9273,-75.2819],'LA GUAJIRA':[11.5444,-72.9072],
  'MAGDALENA':[11.2404,-74.1990],'META':[4.1420,-73.6266],'NARINO':[1.2136,-77.2811],
  'NORTE DE SANTANDER':[7.9463,-72.8988],'PUTUMAYO':[0.4359,-76.5262],'QUINDIO':[4.5389,-75.6807],
  'RISARALDA':[4.8133,-75.6961],'SAN ANDRES Y PROVIDENCIA':[12.5847,-81.7006],
  'SANTANDER':[7.1193,-73.1227],'SUCRE':[9.3047,-75.3978],'TOLIMA':[4.4389,-75.2322],
  'VALLE DEL CAUCA':[3.4516,-76.5320],'VAUPES':[1.2537,-70.2337],'VICHADA':[6.1897,-67.4859],
}

// Ciudades principales (se amplía con un gazetteer completo en fase 1). [lat, lng]
const CIUDADES: Record<string, LatLng> = {
  'BOGOTA':[4.7110,-74.0721],'MEDELLIN':[6.2442,-75.5812],'CALI':[3.4516,-76.5320],
  'BARRANQUILLA':[10.9685,-74.7813],'CARTAGENA':[10.3910,-75.4794],'CUCUTA':[7.8939,-72.5078],
  'BUCARAMANGA':[7.1193,-73.1227],'PEREIRA':[4.8133,-75.6961],'SANTA MARTA':[11.2404,-74.1990],
  'IBAGUE':[4.4389,-75.2322],'MANIZALES':[5.0703,-75.5138],'VILLAVICENCIO':[4.1420,-73.6266],
  'NEIVA':[2.9273,-75.2819],'PASTO':[1.2136,-77.2811],'MONTERIA':[8.7479,-75.8814],
  'ARMENIA':[4.5389,-75.6807],'VALLEDUPAR':[10.4631,-73.2532],'SINCELEJO':[9.3047,-75.3978],
  'POPAYAN':[2.4448,-76.6147],'TUNJA':[5.5353,-73.3678],'RIOHACHA':[11.5444,-72.9072],
  'QUIBDO':[5.6919,-76.6583],'FLORENCIA':[1.6144,-75.6062],'YOPAL':[5.3378,-72.3959],
  'SOACHA':[4.5794,-74.2168],'BELLO':[6.3379,-75.5556],'SOLEDAD':[10.9186,-74.7645],
  'ENVIGADO':[6.1667,-75.5833],'ITAGUI':[6.1719,-75.6111],'PALMIRA':[3.5394,-76.3036],
}

// Localidades de Bogotá (detalle para el segmento Distrito). [lat, lng]
const LOCALIDADES_BOGOTA: Record<string, LatLng> = {
  'USAQUEN':[4.7014,-74.0317],'CHAPINERO':[4.6486,-74.0628],'SANTA FE':[4.6097,-74.0817],
  'SAN CRISTOBAL':[4.5717,-74.0862],'USME':[4.5092,-74.1253],'TUNJUELITO':[4.5753,-74.1317],
  'BOSA':[4.6183,-74.1900],'KENNEDY':[4.6280,-74.1614],'FONTIBON':[4.6714,-74.1469],
  'ENGATIVA':[4.7089,-74.1197],'SUBA':[4.7411,-74.0836],'BARRIOS UNIDOS':[4.6669,-74.0786],
  'TEUSAQUILLO':[4.6447,-74.0936],'LOS MARTIRES':[4.6019,-74.0953],'ANTONIO NARINO':[4.5886,-74.1019],
  'PUENTE ARANDA':[4.6236,-74.1214],'LA CANDELARIA':[4.5964,-74.0756],'RAFAEL URIBE':[4.5636,-74.1086],
  'CIUDAD BOLIVAR':[4.5131,-74.1628],'SUMAPAZ':[4.1989,-74.2319],
}

function coord([lat, lng]: LatLng, fuente: Geo['fuente']): Geo {
  return { lat, lng, fuente }
}

// Tokens ordenados de más largo a más corto para que "CIUDAD BOLIVAR" gane
// sobre "BOLIVAR" y "SANTA FE" sobre coincidencias parciales.
const LOC_TOKENS = Object.keys(LOCALIDADES_BOGOTA).sort((a, b) => b.length - a.length)
const CITY_TOKENS = Object.keys(CIUDADES).sort((a, b) => b.length - a.length)

function contienePalabra(texto: string, token: string): boolean {
  return (' ' + texto + ' ').includes(' ' + token + ' ')
}

export interface GeoTexto { geo: Geo; nombre: string }

/**
 * Geolocaliza a partir de texto libre (dirección, "ciudad" con basura, etc.),
 * igual que hace el script de GAS: busca dentro del texto el nombre de una
 * localidad de Bogotá o de una ciudad conocida. Devuelve las coordenadas y el
 * nombre legible encontrado (para no guardar direcciones crudas ni Ids).
 * Prioriza localidad (Bogotá) sobre ciudad.
 */
export function geolocalizarTexto(...partes: (string | null | undefined)[]): GeoTexto | null {
  const texto = norm(partes.filter(Boolean).join(' '))
  if (!texto) return null
  for (const t of LOC_TOKENS) {
    if (contienePalabra(texto, t)) return { geo: coord(LOCALIDADES_BOGOTA[t], 'localidad'), nombre: capitalizar(t) }
  }
  for (const t of CITY_TOKENS) {
    if (contienePalabra(texto, t)) return { geo: coord(CIUDADES[t], 'ciudad'), nombre: capitalizar(t) }
  }
  return null
}

function capitalizar(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
}

/**
 * Resuelve coordenadas a partir de ciudad (y opcionalmente departamento/localidad).
 * Devuelve null si no se pudo ubicar → el caso igual cuenta, solo no se pinta.
 */
export function resolverGeo(
  { ciudad, departamento, localidad }: { ciudad?: string; departamento?: string; localidad?: string } = {}
): Geo | null {
  const loc = norm(localidad)
  if (loc && LOCALIDADES_BOGOTA[loc]) return coord(LOCALIDADES_BOGOTA[loc], 'localidad')

  const city = norm(ciudad)
  if (city && CIUDADES[city]) return coord(CIUDADES[city], 'ciudad')

  const dep = norm(departamento)
  if (dep && DEPARTAMENTOS[dep]) return coord(DEPARTAMENTOS[dep], 'departamento')

  // Último intento: ¿la "ciudad" en realidad es un departamento?
  if (city && DEPARTAMENTOS[city]) return coord(DEPARTAMENTOS[city], 'departamento')

  return null
}
