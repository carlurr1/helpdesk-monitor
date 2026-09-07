'use client'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { SEG_COLOR } from '@/lib/colors'
import { ciudadLegible } from '@/lib/format'
import type { PuntoMapa } from '@/lib/types'

type Vista = 'calor' | 'puntos'

const SEGMENTOS_BOGOTA = ['Distrito', 'Élite']

// Gradiente del mapa de calor (frío → caliente), en la paleta ETB.
const HEAT_GRADIENT: Record<number, string> = {
  0.2: '#1f7ad1', 0.4: '#12b7b0', 0.6: '#f79009', 0.8: '#ea6b5d', 1.0: '#b42318',
}

// Capa de calor: leaflet.heat vive fuera de react-leaflet; la montamos con
// useMap() y la limpiamos al desmontar o cambiar de datos.
function HeatLayer({ points, max, radius }: { points: [number, number, number][]; max: number; radius: number }) {
  const map = useMap()
  useEffect(() => {
    const layer = (L as any).heatLayer(points, {
      radius, blur: radius * 0.75, max, minOpacity: 0.35, maxZoom: 17, gradient: HEAT_GRADIENT,
    })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, points, max, radius])
  return null
}

// Mapa de calor adaptativo: Bogotá para Distrito/Élite, nacional para el resto.
// Recibe los puntos YA agregados por el servidor (open + ubicados).
export default function MapaCasos({ puntos, segmento, esBogota: esBogotaProp }: { puntos: PuntoMapa[]; segmento: string; esBogota?: boolean }) {
  const esBogota = esBogotaProp ?? SEGMENTOS_BOGOTA.includes(segmento)
  const [vista, setVista] = useState<Vista>('calor')

  const totalGeo = puntos.reduce((a, p) => a + p.count, 0)
  const maxC = Math.max(1, ...puntos.map((p) => p.count))
  const center: [number, number] = esBogota ? [4.65, -74.09] : [4.6, -74.3]
  const zoom = esBogota ? 11 : 6
  const heatPts = useMemo<[number, number, number][]>(() => puntos.map((p) => [p.lat, p.lng, p.count]), [puntos])

  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <div>
          <div className="card-title">{esBogota ? 'Mapa de calor · Bogotá' : 'Mapa de calor · Colombia'}</div>
          <div className="card-sub tnum">{totalGeo.toLocaleString('es-CO')} abiertos ubicados</div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--border-strong)] text-[12px] font-semibold">
          {(['calor', 'puntos'] as Vista[]).map((v) => (
            <button key={v} onClick={() => setVista(v)}
              className={'px-3 py-[6px] ' + (vista === v ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]')}>
              {v === 'calor' ? 'Calor' : 'Puntos'}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 pt-0">
      {/* key = alcance del mapa: react-leaflet solo aplica center/zoom al montar. */}
      <MapContainer key={esBogota ? 'bogota' : 'colombia'} center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: 440, width: '100%', borderRadius: 8, marginTop: 12 }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {vista === 'calor' && puntos.length > 0 && (
          <HeatLayer points={heatPts} max={maxC} radius={esBogota ? 32 : 24} />
        )}
        {vista === 'puntos' && puntos.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={6 + 16 * (p.count / maxC)}
            pathOptions={{ color: SEG_COLOR[p.seg] ?? '#0b5aa5', fillColor: SEG_COLOR[p.seg] ?? '#0b5aa5', fillOpacity: 0.55, weight: 1 }}
          >
            <Popup>
              <strong>{ciudadLegible(p.ciudad, 'Sin ciudad')}</strong><br />{p.count.toLocaleString('es-CO')} caso(s)
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {vista === 'calor' && puntos.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 px-1 text-[10px] font-semibold text-[var(--muted)]">
          <span>Menos</span>
          <span className="h-1.5 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg,#1f7ad1,#12b7b0,#f79009,#ea6b5d,#b42318)' }} />
          <span>Más casos</span>
        </div>
      )}
      {!puntos.length && (
        <p className="mt-3 text-center text-sm text-[var(--muted)]">Sin casos abiertos ubicados en esta vista.</p>
      )}
      </div>
    </div>
  )
}
