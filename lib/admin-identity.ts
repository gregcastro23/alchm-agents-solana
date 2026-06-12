export type AdminIdentity = {
  id?: string | null
  email?: string | null
  name?: string | null
}

const DEFAULT_ADMIN_EMAILS = [
  'admin@planetaryagents.com',
  'support@planetaryagents.com',
  'gregcastro23@gmail.com',
]

const DEFAULT_ADMIN_HANDLES = ['gregcastro23']

export const GREG_EMAIL = 'gregcastro23@gmail.com'
export const GREG_HANDLE = 'gregcastro23'

function parseList(value?: string) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

export function normalizeHandle(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

export const ADMIN_EMAILS = unique([
  ...DEFAULT_ADMIN_EMAILS,
  ...parseList(process.env.ADMIN_EMAILS),
  ...parseList(process.env.NEXT_PUBLIC_ADMIN_EMAILS),
]).map(normalizeEmail)

export const ADMIN_HANDLES = unique([
  ...DEFAULT_ADMIN_HANDLES,
  ...parseList(process.env.ADMIN_HANDLES),
  ...parseList(process.env.NEXT_PUBLIC_ADMIN_HANDLES),
])
  .map(normalizeHandle)
  .filter(Boolean)

export function getIdentityHandles(identity?: AdminIdentity | null) {
  if (!identity) return []

  const email = normalizeEmail(identity.email)
  const emailHandle = email.includes('@') ? email.split('@')[0] : email

  return unique([identity.id, identity.name, emailHandle].map(normalizeHandle).filter(Boolean))
}

export function isGregIdentity(identity?: AdminIdentity | null) {
  if (!identity) return false

  const email = normalizeEmail(identity.email)
  return email === GREG_EMAIL || getIdentityHandles(identity).includes(GREG_HANDLE)
}

export function isConfiguredAdminIdentity(identity?: AdminIdentity | null) {
  if (!identity) return false

  const email = normalizeEmail(identity.email)
  if (email && ADMIN_EMAILS.includes(email)) return true

  const handles = getIdentityHandles(identity)
  return handles.some(handle => ADMIN_HANDLES.includes(handle))
}
