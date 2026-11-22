/**
 * Configured operator / admin email allowlist.
 *
 * Used for:
 *  - break-glass admin console access during a total database outage (only when
 *    the session itself carries `role: 'admin'` and the DB lookup fails as
 *    unavailable — never overrides a live DB user record);
 *  - operator alert email delivery recipients (`AUTH_ADMIN_EMAIL` / `ADMIN_EMAILS`).
 */

function splitEmails(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,;\s]+/)
    .map(part => part.trim().toLowerCase())
    .filter(email => email.includes('@'))
}

export function getConfiguredAdminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  const combined = new Set<string>([
    ...splitEmails(env.AUTH_ADMIN_EMAIL),
    ...splitEmails(env.ADMIN_EMAILS),
  ])
  return [...combined]
}

export function isConfiguredAdminEmail(
  email?: string | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return getConfiguredAdminEmails(env).includes(normalized)
}
