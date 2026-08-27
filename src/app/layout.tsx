import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Monitor Help Desk — ETB',
  description: 'Monitor unificado de casos de soporte técnico en Salesforce por segmento',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
