'use client'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Caso } from '@/lib/types'
import { SEG_COLOR } from '@/lib/colors'

interface Punto { lat: number; lng: number; ciudad: string; seg: string; count: number }

// Segmentos distritales (operación 100 % en Bogotá): el mapa se centra en la
// ciudad. El resto de segmentos (y "Todos") usan la vista nacional de Colombia.
const SEGMENTOS_BOGOTA = ['Distrito', 'Élite']

// Mapa adaptativo: Bogotá para Distrito y Élite, nacional para el resto.
// Agrupa los casos por coordenada para no pintar miles de marcadores.
export default function MapaCasos({ rows, segmento }: { rows: Caso[]; segmento: string }) {
  const grupos = new Map<string, Punto>()
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue
    const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
    const g = grupos.get(key)
    if (g) g.count++
    else grupos.set(key, { lat: r.lat, lng: r.lng, ciudad: r.ciudad || 'Sin ciudad', seg: r.segmento, count: 1 })
  }
  const puntos = [...grupos.values()]
  const totalGeo = puntos.reduce((a, p) => a + p.count, 0)
  const esBogota = SEGMENTOS_BOGOTA.includes(segmento)
  const center: [number, number] = esBogota ? [4.65, -74.09] : [4.6, -74.3]
  const zoom = esBogota ? 11 : 6
  const maxC = Math.max(1, ...puntos.map((p) => p.count))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {esBogota ? 'Mapa · Bogotá' : 'Mapa · Colombia'}
        </h3>
        <span className="text-xs text-slate-400">{totalGeo.toLocaleString('es-CO')} casos ubicados</span>
      </div>
      {/* key = alcance del mapa: react-leaflet solo aplica center/zoom al montar,
          así que forzamos el remonte cuando se cambia entre Bogotá y Colombia. */}
      <MapContainer key={esBogota ? 'bogota' : 'colombia'} center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: 440, width: '100%', borderRadius: 8 }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {puntos.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={6 + 16 * (p.count / maxC)}
            pathOptions={{ color: SEG_COLOR[p.seg] ?? '#0b5aa5', fillColor: SEG_COLOR[p.seg] ?? '#0b5aa5', fillOpacity: 0.55, weight: 1 }}
          >
            <Popup>
              <strong>{p.ciudad}</strong><br />{p.count.toLocaleString('es-CO')} caso(s)
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {!puntos.length && (
        <p className="mt-2 text-center text-sm text-slate-400">
          Sin casos ubicados (las ciudades del caso no coincidieron con el catálogo de geo).
        </p>
      )}
    </div>
  )
}
