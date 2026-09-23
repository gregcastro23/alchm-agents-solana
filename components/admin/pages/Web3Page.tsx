'use client'

import Web3TelemetryPanel from '@/components/admin/panels/Web3TelemetryPanel'
import { AdminFrame } from './AdminFrame'

// Its own module: the panel pulls in viem, which no other admin page needs.
export function Web3Page() {
  return (
    <AdminFrame
      title="Arc & Base (EVM)"
      description="The EVM side of the economy: contracts on Arc testnet and Base Sepolia, checked on demand from your browser."
    >
      <Web3TelemetryPanel />
    </AdminFrame>
  )
}
