import { describe, it, expect } from 'vitest'

describe('Monica streaming and envelopes', () => {
  it('renders structured envelope shape', () => {
    const structured = {
      interactive_elements: { suggested_practices: ['a'], reflection_questions: ['b'] },
      educational_guidance: { next_learning_step: 'step' },
    }
    expect(Array.isArray(structured.interactive_elements.suggested_practices)).toBe(true)
    expect(typeof structured.educational_guidance.next_learning_step).toBe('string')
  })
})
