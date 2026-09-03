// Paleta ETB (misma del tablero de Apps Script).
export const ETB = {
  blue: '#0b5aa5', blue2: '#1f7ad1', teal: '#12b7b0',
  coral: '#ea6b5d', yellow: '#f79009', green: '#12b76a',
  muted: '#66758a', border: '#dde6f2',
}

// Colores del semáforo por antigüedad.
export const SEMAFORO_COLOR = { critical: '#ea6b5d', warning: '#f79009', healthy: '#12b76a' }

// Color por segmento (selector, tarjetas y gráficas).
export const SEG_COLOR: Record<string, string> = {
  Distrito:         '#7c3aed',
  'Élite':          '#0ea5e9',
  Premium:          '#0b5aa5',
  Mayoristas:       '#d97706',
  Silver:           '#64748b',
  Gold:             '#ca8a04',
  'Sin clasificar': '#cbd5e1',
}
