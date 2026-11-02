import { permanentRedirect } from 'next/navigation'

export default function VaultDirectoryRedirectPage() {
  permanentRedirect('/gallery')
}
