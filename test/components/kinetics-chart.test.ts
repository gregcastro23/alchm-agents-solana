import { describe, it, expect } from 'vitest'
import { computeLocalKinetics } from '../../components/charts/kinetics-chart-pane'

describe('computeLocalKinetics Data Normalization', () => {
  it('should never return NaN for any property even with invalid inputs', () => {
    // Generate an invalid date (which typically causes Date operations to return NaN)
    const invalidDate = new Date('Invalid Date')

    const metrics = computeLocalKinetics(invalidDate)

    expect(Number.isNaN(metrics.A)).toBe(false)
    expect(Number.isNaN(metrics.SMES.spirit)).toBe(false)
    expect(Number.isNaN(metrics.SMES.matter)).toBe(false)
    expect(Number.isNaN(metrics.SMES.essence)).toBe(false)
    expect(Number.isNaN(metrics.SMES.substance)).toBe(false)
    expect(Number.isNaN(metrics.kinetic.velocity)).toBe(false)
    expect(Number.isNaN(metrics.kinetic.momentum)).toBe(false)
    expect(Number.isNaN(metrics.kinetic.power)).toBe(false)
    expect(Number.isNaN(metrics.kinetic.inertia)).toBe(false)
    expect(Number.isNaN(metrics.consciousness.resonance)).toBe(false)
    expect(Number.isNaN(metrics.consciousness.amplitude)).toBe(false)
    expect(Number.isNaN(metrics.consciousness.activation)).toBe(false)
  })

  it('should return valid numbers for a standard valid date', () => {
    const validDate = new Date('2026-05-13T12:00:00Z')

    const metrics = computeLocalKinetics(validDate)

    expect(metrics.A).toBeGreaterThanOrEqual(0)
    expect(metrics.SMES.spirit).toBeGreaterThanOrEqual(0)
    expect(metrics.kinetic.velocity).toBeGreaterThanOrEqual(0)
    expect(metrics.consciousness.resonance).toBeGreaterThanOrEqual(0)

    // Ensure no NaN values
    expect(Number.isNaN(metrics.A)).toBe(false)
    expect(Number.isNaN(metrics.SMES.spirit)).toBe(false)
  })

  it('should safely clamp values to the expected ranges [0, 1] (or [0, 2] for A)', () => {
    const validDate = new Date('2026-06-21T18:00:00Z') // Summer solstice afternoon

    const metrics = computeLocalKinetics(validDate)

    expect(metrics.SMES.spirit).toBeLessThanOrEqual(1)
    expect(metrics.SMES.matter).toBeLessThanOrEqual(1)
    expect(metrics.kinetic.velocity).toBeLessThanOrEqual(1)
    expect(metrics.A).toBeLessThanOrEqual(2)
  })
})
