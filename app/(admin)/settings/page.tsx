import { permanentRedirect } from 'next/navigation'

export default function LegacySettingsRedirectPage() {
  permanentRedirect('/account')
}
