// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ORACLE_SYSTEM_PROMPT, ORACLE_SYSTEM_PROMPT_SHA256 } from '@/lib/agents/oracle-persona'

/**
 * The Oracle persona is the prompt-caching prefix and is shared byte-for-byte with
 * the Python brain (backend/oracle_persona.py asserts the same digest). Editing
 * either copy without the other must fail a test on whichever side moved.
 */
const PINNED_SHA256 = 'f256dc75c68ef4f2599af4db3bdf81bb640db1e03a98a72e380d157b1ebb66b1'

describe('Oracle persona (byte-stable prompt-cache prefix)', () => {
  it('hashes to the exported digest', () => {
    const digest = createHash('sha256').update(ORACLE_SYSTEM_PROMPT, 'utf8').digest('hex')
    expect(digest).toBe(ORACLE_SYSTEM_PROMPT_SHA256)
  })

  it('has the digest the Python side pins', () => {
    expect(ORACLE_SYSTEM_PROMPT_SHA256).toBe(PINNED_SHA256)
    expect(createHash('sha256').update(ORACLE_SYSTEM_PROMPT, 'utf8').digest('hex')).toBe(
      PINNED_SHA256
    )
  })

  it('has no interpolation points: the question and sky belong in the user turn', () => {
    expect(ORACLE_SYSTEM_PROMPT).not.toContain('${')
    expect(ORACLE_SYSTEM_PROMPT).not.toContain('{question}')
    expect(ORACLE_SYSTEM_PROMPT).not.toContain('{context}')
  })
})
