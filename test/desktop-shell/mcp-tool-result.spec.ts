import { describe, expect, it } from 'vitest'
import { parseMcpToolJson } from '../../desktop-shell/src/mcpToolResult'

describe('MCP tool result decoding', () => {
  it('prefers structured content over legacy text', () => {
    expect(
      parseMcpToolJson({
        structuredContent: { text: 'typed result' },
        content: [{ type: 'text', text: '{"text":"old result"}' }],
      })
    ).toEqual({ text: 'typed result' })
  })

  it('accepts JSON text results from older binaries', () => {
    expect(parseMcpToolJson({ content: [{ type: 'text', text: '{"text":"legacy"}' }] })).toEqual({
      text: 'legacy',
    })
  })

  it('rejects tool errors even when structured content looks successful', () => {
    expect(() =>
      parseMcpToolJson({
        isError: true,
        structuredContent: { text: 'success' },
        content: [{ type: 'text', text: 'Publisher authorization required' }],
      })
    ).toThrow('Publisher authorization required')
  })

  it.each([null, [], 'not an object'])('rejects malformed structured content: %j', value => {
    expect(() => parseMcpToolJson({ structuredContent: value })).toThrow('Invalid MCP structured')
  })

  it('rejects malformed error status', () => {
    expect(() => parseMcpToolJson({ isError: 'false' })).toThrow('Invalid MCP tool error status')
  })

  it.each([null, {}, { content: [] }, { content: [{ type: 'text', text: 'not json' }] }])(
    'returns null for absent or undecodable payloads: %j',
    value => {
      expect(parseMcpToolJson(value)).toBeNull()
    }
  )
})
