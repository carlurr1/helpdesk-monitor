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
  return String(s ?? '')
    .trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes (marcas combinantes)
    .replace(/\bBOGOTA D\.?C\.?\b/, 'BOGOTA')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
