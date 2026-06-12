export type ElementalLogicMode = 'additive' | 'legacy'

export function recordElementalLogicMode(mode: ElementalLogicMode): void {
  try {
    // Placeholder analytics hook for A/B testing; wire to real telemetry later
    // Intentionally lightweight and non-blocking
    // eslint-disable-next-line no-console
    console.log(`[analytics] elemental_logic_mode=${mode}`)
  } catch {
    // no-op
  }
}
