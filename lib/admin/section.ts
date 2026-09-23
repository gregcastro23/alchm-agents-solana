/**
 * One independently-read part of an admin payload. A read that fails carries
 * its reason instead of a value, so the page can show "—" and why — never a
 * zero or an empty list that looks like a healthy answer.
 */
export type Section<T> = { ok: true; value: T } | { ok: false; reason: string }

export async function readSection<T>(read: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, value: await read() }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 300) : String(err) }
  }
}

/** Labels of the sections that could not be read, for a "degraded" alert. */
export function unreadable(sections: Record<string, Section<unknown>>): string[] {
  return Object.entries(sections)
    .filter(([, s]) => !s.ok)
    .map(([name]) => name)
}
