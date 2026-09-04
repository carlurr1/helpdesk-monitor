// ============================================================
//  Geocodificador con caché — dirección → {lat,lng, ciudad}
//  Estrategia en 3 niveles (mezcla catálogo + geocodificador real):
//    1) Catálogo local (ciudad/localidad exacta)         — instantáneo
//    2) Escaneo de texto (localidad/ciudad en la cadena) — instantáneo
//    3) Nominatim (OpenStreetMap) con caché en Supabase   — preciso (CRA/CLLE)
//  Nunca rompe el sync: cualquier fallo devuelve null y el caso sigue contando.
// ============================================================
import { supabaseServer } from './supabase'
import { resolverGeo, geolocalizarTexto, extraerCoordenadas } from './geo'

export interface GeoResuelto { lat: number; lng: number; ciudad: string; fuente: string }

const UA = process.env.GEOCODER_UA || 'helpdesk-monitor/1.0 (soporte-monitor)'
const BASE = 'https://nominatim.openstreetmap.org/search'
// Llamadas NUEVAS a Nominatim por corrida (el resto sale de caché). Se limita
// para no exceder maxDuration del endpoint (cada llamada espera ~1.1 s).
const BUDGET = parseInt(process.env.GEOCODER_BUDGET || '45', 10)
const DELAY_MS = 1100
const BOGOTA_CENTRO = { lat: 4.6533, lng: -74.0836 }

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function normDir(s: unknown): string {
  return String(s ?? '')
    .trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 #\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class Geocoder {
  private mem = new Map<string, GeoResuelto | null>()
  private cache = new Map<string, GeoResuelto>()
  private nuevos: { direccion: string; lat: number; lng: number; ciudad: string; fuente: string }[] = []
  private llamadas = 0
  llamadasHechas = 0

  /** Carga la caché persistente de Supabase (si la tabla existe). */
  async cargarCache(): Promise<void> {
    try {
      const sb = supabaseServer()
      const { data } = await sb.from('geocache').select('direccion, lat, lng, ciudad, fuente')
      for (const r of data ?? []) {
        if (r.lat != null && r.lng != null) {
          this.cache.set(r.direccion, { lat: r.lat, lng: r.lng, ciudad: r.ciudad || '', fuente: r.fuente || 'cache' })
        }
      }
    } catch { /* sin tabla o sin acceso: seguimos sin caché */ }
  }

  /**
   * Resuelve coordenadas de un caso. `ciudadNombre` es el nombre legible de la
   * población (Ciudad_Instalacion__r.Name); `direccion` es Direccion_Instalacion__c.
   */
  async resolver(ciudadNombre: string, direccion: string): Promise<GeoResuelto | null> {
    // 0) Coordenadas embebidas en la dirección (lo más preciso).
    const coord = extraerCoordenadas(direccion) || extraerCoordenadas(ciudadNombre)
    if (coord) return { ...coord, ciudad: ciudadNombre.trim() || 'Ubicado', fuente: 'coordenada' }

    // 1) Token de localidad/ciudad dentro del texto (ciudad + dirección). Va
    //    primero que el catálogo simple para preferir la LOCALIDAD (p.ej. Puente
    //    Aranda) sobre el centro genérico de Bogotá cuando la dirección la nombra.
    const t = geolocalizarTexto(ciudadNombre, direccion)
    if (t) return { lat: t.geo.lat, lng: t.geo.lng, ciudad: ciudadNombre.trim() || t.nombre, fuente: 'texto' }

    // 2) Catálogo (incluye departamento como último recurso del diccionario).
    const cat = resolverGeo({ ciudad: ciudadNombre, localidad: ciudadNombre })
    if (cat) return { lat: cat.lat, lng: cat.lng, ciudad: ciudadNombre.trim(), fuente: cat.fuente }

    // 3) Geocodificador real sobre la dirección (con caché).
    const consulta = (direccion || ciudadNombre || '').trim()
    if (!consulta) return null
    const key = normDir(consulta)
    if (!key) return null
    if (this.mem.has(key)) return this.mem.get(key)!
    const enCache = this.cache.get(key)
    if (enCache) { this.mem.set(key, enCache); return enCache }

    let geo: GeoResuelto | null = null
    if (this.llamadas < BUDGET) {
      geo = await this.nominatim(consulta)
      if (geo) this.nuevos.push({ direccion: key, lat: geo.lat, lng: geo.lng, ciudad: geo.ciudad, fuente: geo.fuente })
    }
    // Fallback: si la dirección/ciudad menciona Bogotá, centro de Bogotá.
    if (!geo && /\bBOGOTA\b/.test(normDir(consulta))) {
      geo = { ...BOGOTA_CENTRO, ciudad: 'Bogotá', fuente: 'bogota-centro' }
    }
    this.mem.set(key, geo)
    return geo
  }

  private async nominatim(consulta: string): Promise<GeoResuelto | null> {
    this.llamadas++
    this.llamadasHechas++
    await sleep(DELAY_MS) // respeta el límite de uso de Nominatim (1 req/s)
    try {
      const q = /colombia/i.test(consulta) ? consulta : `${consulta}, Colombia`
      const url = `${BASE}?format=jsonv2&limit=1&countrycodes=co&addressdetails=1&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' } })
      if (!res.ok) return null
      const arr = await res.json()
      if (!Array.isArray(arr) || !arr.length) return null
      const h = arr[0]
      const a = h.address || {}
      const localidad = a.suburb || a.city_district || a.borough || a.neighbourhood
      const ciudad = a.city || a.town || a.municipality || localidad || a.state || ''
      const lat = parseFloat(h.lat), lng = parseFloat(h.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng, ciudad: String(localidad || ciudad || 'Ubicado').trim(), fuente: 'nominatim' }
    } catch { return null }
  }

  /** Persiste en Supabase las direcciones nuevas geocodificadas. */
  async guardarCache(): Promise<void> {
    if (!this.nuevos.length) return
    try {
      const sb = supabaseServer()
      await sb.from('geocache').upsert(this.nuevos, { onConflict: 'direccion' })
    } catch { /* sin tabla: no se persiste, pero el sync ya usó los valores */ }
  }
}
