import {
  resolveGroqModel,
  resolveOpenAIModel,
  resolveGoogleModel,
  resolveDefaultModel,
} from '../models/registry'
import type { LanguageModel } from 'ai'

export type RoutingDecision = {
  modelId: string
  model: LanguageModel
  reason: 'default' | 'complexity_elevate' | 'risk_elevate'
}

export function decideModel(opts: {
  defaultModel?: string
  complexity?: 'simple' | 'moderate' | 'complex'
  hallucinationRisk?: 'low' | 'med' | 'high'
}): RoutingDecision {
  let tier: 'default' | 'powerful' = 'default'
  let reason: RoutingDecision['reason'] = 'default'

  if (opts.complexity === 'complex' || opts.hallucinationRisk === 'high') {
    tier = 'powerful'
    reason = opts.complexity === 'complex' ? 'complexity_elevate' : 'risk_elevate'
  }

  // Default to Groq (free tier) for standard operations
  let model: LanguageModel
  let modelId: string

  if (tier === 'powerful') {
    // Escalate to paid/powerful models for complex multi-agent coordination
    model = resolveOpenAIModel('powerful') // or resolveGoogleModel('powerful') depending on preference
    modelId = opts.defaultModel || process.env.MONICA_DEFAULT_MODEL || 'gpt-4o'
  } else {
    // Standard fast/free tier operations
    model = resolveGroqModel('fast')
    modelId = opts.defaultModel || 'llama-3.1-8b-instant' // Groq's fast model
  }

  return { modelId, model, reason }
}
