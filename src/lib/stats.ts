// Utilidades de estadística y formato (percentiles, tiempos de atención).

export interface Stats {
  n: number
  media: number | null
  mediana: number | null
  p75: number | null
  p90: number | null
  min: number | null
  max: number | null
}

export function calcularStats(tiempos: number[]): Stats {
  if (!tiempos.length) return { n: 0, media: null, mediana: null, p75: null, p90: null, min: null, max: null }
  const s = [...tiempos].sort((a, b) => a - b)
  const n = s.length
  const suma = s.reduce((a, b) => a + b, 0)
  const pct = (p: number) => {
    const idx = (p / 100) * (n - 1)
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    return lo === hi ? +s[lo].toFixed(2) : +(s[lo] + (s[hi] - s[lo]) * (idx - lo)).toFixed(2)
  }
  return { n, media: +(suma / n).toFixed(2), mediana: pct(50), p75: pct(75), p90: pct(90), min: +s[0].toFixed(2), max: +s[n - 1].toFixed(2) }
}

export function fmtMin(min: number | null): string {
  if (min === null) return '-'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
