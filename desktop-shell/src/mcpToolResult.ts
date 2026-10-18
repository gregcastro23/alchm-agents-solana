/** Decode typed MCP results while retaining the JSON-text contract of older sidecars. */
export function parseMcpToolJson<T = unknown>(result: unknown): T | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null
  const value = result as Record<string, unknown>
  if (value.isError !== undefined && typeof value.isError !== 'boolean') {
    throw new Error('Invalid MCP tool error status')
  }
  const content = Array.isArray(value.content) ? value.content : []
  const text = content
    .map(item =>
      item && typeof item === 'object' && typeof item.text === 'string' ? item.text : ''
    )
    .filter(Boolean)
    .join('\n')
    .trim()
  if (value.isError) throw new Error(text || 'MCP tool returned an error')
  if (value.structuredContent !== undefined) {
    if (
      !value.structuredContent ||
      typeof value.structuredContent !== 'object' ||
      Array.isArray(value.structuredContent)
    ) {
      throw new Error('Invalid MCP structured tool result')
    }
    return value.structuredContent as T
  }
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
