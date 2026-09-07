import Dashboard from '@/components/Dashboard'
import { AuthGate } from '@/components/shell/AuthGate'

export default function Home() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  )
}
