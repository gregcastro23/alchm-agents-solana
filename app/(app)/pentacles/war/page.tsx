import type { Metadata } from 'next'
import PentaclesWarClient from './pentacles-war-client'

export const metadata: Metadata = {
  title: 'War Table Command · Pentacles',
  description:
    'Live faction standings, ASOL agent intent, territorial control, and War Table operations.',
}

export default function PentaclesWarPage() {
  return <PentaclesWarClient />
}
