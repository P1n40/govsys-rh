import GovShell from '@/components/layout/gov-shell'
import { GovProvider } from '@/components/providers/gov-provider'
import type { ReactNode } from 'react'

export default function GovLayout({ children }: { children: ReactNode }) {
  return (
    <GovProvider>
      <GovShell>{children}</GovShell>
    </GovProvider>
  )
}
