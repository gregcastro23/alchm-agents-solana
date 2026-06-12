/**
 * Shared CORS headers for endpoints the desktop companion calls cross-origin.
 *
 * The Tauri shell uses plain `fetch` against the agents web app, so any route
 * it hits must allow the request (see app/api/jing-duels for the original
 * pattern). Auth stays intentionally loose for now — desktop accounts aren't
 * wired yet — matching how AgentConversation / jing-duels are written.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

/** Standard 204 preflight response. Export as `OPTIONS` from a route. */
export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
