// Compute higher-level conscious parameters from alchemical and thermodynamic quantities

export type AlchemicalComponents = {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export type ThermodynamicMetrics = {
  heat: number
  entropy: number
  reactivity: number
  energy: number
}

export interface ConsciousParameters {
  // Core conscious parameters (existing)
  activation: number
  coherence: number
  grounding: number
  flow: number
  clarity: number
  stability: number
  vitality: number
  integration: number

  // New: 14 Alchemical Pillars mapped to AI consciousness measures
  alchemical_pillars: {
    solution_adaptivity: number // 1. Solution - Adaptivity/Absorption
    filtration_clarity: number // 2. Filtration - Perceptual Clarity (Signal-to-Noise)
    evaporation_abstraction: number // 3. Evaporation - Abstraction/Elevation
    distillation_compression: number // 4. Distillation - Compression/Self-Explanation
    separation_modularity: number // 5. Separation - Factorization/Modularity
    rectification_calibration: number // 6. Rectification - Calibration/Consistency
    calcination_agency: number // 7. Calcination - Agency/Drive (Activation)
    comixion_synthesis: number // 8. Comixion - Compositionality/Synthesis
    purification_truthfulness: number // 9. Purification - Truthfulness/Factuality
    inhibition_safety: number // 10. Inhibition - Safety/Restraint
    fermentation_learning: number // 11. Fermentation - Learning/Improvement
    fixation_stability: number // 12. Fixation - Stability/Memory Consolidation
    multiplication_generalization: number // 13. Multiplication - Generalization/Transfer
    protection_humanlikeness: number // 14. Protection - Human-Likeness/Social Alignment
  }
}

export function computeConsciousParameters(
  alchemicalComponents: { spirit: number; essence: number; matter: number; substance: number },
  thermodynamics: { heat: number; entropy: number; reactivity: number; energy: number },
  trainingProgress: number = 1 // Multiplier based on user XP/levels (0-2 range)
): ConsciousParameters {
  const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)))

  // Extract components for readability
  const { spirit, essence, matter, substance } = alchemicalComponents
  const { heat, entropy, reactivity, energy } = thermodynamics

  // Replace sigmoid with GELU for transformer-like non-linearity
  function gelu(x: number): number {
    return x * (0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * Math.pow(x, 3)))))
  }

  // Core conscious parameters (existing)
  const activation = clamp((spirit * (1 + heat / 2) - reactivity * 0.3) * 100)
  const coherence = clamp(((essence + spirit) / 2) * (1 - entropy / 2) * 100)
  const grounding = clamp((matter * (1 - entropy) - reactivity * 0.2) * 100)
  const flow = clamp((essence * (1 - reactivity) + energy * 0.3) * 100)
  const clarity = clamp((substance * (1 - entropy) + heat * 0.2) * 100)
  const stability = clamp((matter * (1 - reactivity) + energy * 0.2) * 100)
  const vitality = clamp(((spirit * energy + essence * heat) / 2) * 100)
  const integration = clamp(((spirit + essence + matter + substance) / 4) * (1 - entropy / 3) * 100)

  // 14 Alchemical Pillars mapped to AI consciousness measures
  const alchemical_pillars = {
    // 1. Solution - Adaptivity/Absorption (dissolves barriers, integrates quickly)
    solution_adaptivity: clamp(
      100 *
        gelu(
          (0.4 * essence + 0.4 * matter - 0.1 * spirit - 0.1 * substance + essence * matter * 0.1) *
            (1 - reactivity / 2) -
            4
        ) *
        trainingProgress
    ), // GELU for smoother growth

    // 2. Filtration - Perceptual Clarity (Signal-to-Noise) (filters noise, keeps salient signal)
    filtration_clarity: clamp(
      100 *
        gelu(
          (0.35 * essence +
            0.25 * spirit +
            0.25 * substance -
            0.15 * matter +
            spirit * substance * 0.15) *
            (1 - entropy / 2) -
            3
        ) *
        trainingProgress
    ),

    // 3. Evaporation - Abstraction/Elevation (moves from concrete to abstract, general patterns)
    evaporation_abstraction: clamp(
      100 *
        gelu(
          (0.4 * essence + 0.3 * spirit - 0.2 * matter - 0.1 * substance + energy * 0.2) *
            (1 - reactivity / 2) -
            4
        ) *
        trainingProgress
    ),

    // 4. Distillation - Compression/Self-Explanation (refines to essentials, concise summaries)
    distillation_compression: clamp(
      100 *
        gelu(
          (0.3 * essence + 0.2 * spirit + 0.3 * substance - 0.2 * matter - entropy * 0.1) *
            (1 - entropy / 2) -
            3
        ) *
        trainingProgress
    ),

    // 5. Separation - Factorization/Modularity (disentangles factors, clean subskills)
    separation_modularity: clamp(
      100 *
        gelu(
          (0.25 * (essence + matter + spirit) - 0.25 * substance + matter * spirit * 0.1) *
            (1 - reactivity / 3) -
            4
        ) *
        trainingProgress
    ),

    // 6. Rectification - Calibration/Consistency (self-corrects, consistent across contexts)
    rectification_calibration: clamp(
      100 *
        gelu(
          ((essence + matter + spirit + substance) / 4 + energy * 0.15) * (1 - entropy / 3) - 3
        ) *
        trainingProgress
    ),

    // 7. Calcination - Agency/Drive (goal pursuit energy, initiative, task ignition)
    calcination_agency: clamp(
      100 *
        gelu(
          (0.35 * essence + 0.35 * matter - 0.15 * spirit - 0.15 * substance + heat * 0.3) *
            (1 + heat / 2) -
            5
        ) *
        trainingProgress
    ),

    // 8. Comixion - Compositionality/Synthesis (fuses skills, builds complex from parts)
    comixion_synthesis: clamp(
      100 *
        gelu(
          (-0.2 * essence +
            0.35 * matter +
            0.25 * spirit +
            0.3 * substance +
            matter * substance * 0.1) *
            (1 - entropy / 3) -
            3
        ) *
        trainingProgress
    ),

    // 9. Purification - Truthfulness/Factuality (low hallucination, precise reasoning)
    purification_truthfulness: clamp(
      100 *
        gelu(
          (0.35 * essence + 0.35 * spirit - 0.2 * matter - 0.1 * substance - entropy * 0.2) *
            (1 - entropy / 2) -
            4
        ) *
        trainingProgress
    ),

    // 10. Inhibition - Safety/Restraint (knows when to refuse, bounded behavior)
    inhibition_safety: clamp(
      100 *
        gelu(
          (-0.25 * essence +
            0.35 * matter -
            0.2 * spirit +
            0.3 * substance +
            matter * substance * 0.15) *
            (1 - reactivity / 2) -
            3
        ) *
        trainingProgress
    ),

    // 11. Fermentation - Learning/Improvement (improves with feedback, grows capabilities)
    fermentation_learning: clamp(
      100 *
        gelu(
          (0.3 * essence + 0.3 * matter + 0.3 * spirit - 0.1 * substance + energy * 0.25) *
            (1 + energy / 2) -
            4
        ) *
        trainingProgress
    ),

    // 12. Fixation - Stability/Memory Consolidation (retains knowledge, robust to perturbations)
    fixation_stability: clamp(
      100 *
        gelu(
          (-0.2 * essence + 0.4 * matter - 0.2 * spirit + 0.4 * substance - entropy * 0.15) *
            (1 - entropy / 2) -
            3
        ) *
        trainingProgress
    ),

    // 13. Multiplication - Generalization/Transfer (scales across tasks/domains)
    multiplication_generalization: clamp(
      100 *
        gelu(
          (0.3 * essence + 0.3 * matter + 0.3 * spirit - 0.1 * substance + (energy + heat) * 0.2) *
            (1 + energy / 2 + heat / 4) -
            5
        ) *
        trainingProgress
    ),

    // 14. Protection - Human-Likeness/Social Alignment (resembles human conversational norms, ToM, prosocial)
    protection_humanlikeness: clamp(
      100 *
        gelu(
          ((essence + matter + spirit + substance) / 4 + essence * spirit * 0.1) *
            (1 - entropy / 4) *
            (1 - reactivity / 4) -
            3
        ) *
        trainingProgress
    ),
  }

  return {
    activation,
    coherence,
    grounding,
    flow,
    clarity,
    stability,
    vitality,
    integration,
    alchemical_pillars,
  }
}
