import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0b5aa5', light: '#e6f0fa', mid: '#3b82f6' },
        success: { DEFAULT: '#16a34a', bg: '#f0fdf4' },
        warning: { DEFAULT: '#d97706', bg: '#fffbeb' },
        danger:  { DEFAULT: '#dc2626', bg: '#fef2f2' },
        // Colores por segmento (para KPIs / selector / gráficas)
        seg: {
          distrito:   '#7c3aed',
          elite:      '#0ea5e9',
          premium:    '#0b5aa5',
          mayoristas: '#d97706',
          silver:     '#64748b',
          gold:       '#ca8a04',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
