/**
 * Client-side sign-out.
 *
 * `/api/logout` is POST-only and same-origin: a GET sign-out is triggerable by
 * any page that can cause a navigation, so it is forgeable. Call this instead of
 * navigating to the endpoint.
 */
export async function signOutViaApi(destination = '/'): Promise<void> {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      redirect: 'follow',
    })
  } catch {
    // The cookies may already be cleared; fall through to the redirect either
    // way rather than stranding the user on a page that thinks they are signed in.
  }
  window.location.href = destination
}
