import { permanentRedirect } from 'next/navigation'

export default function RunesRedirectPage() {
  permanentRedirect('/rune-forge?tab=codex')
}
