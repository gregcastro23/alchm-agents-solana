// Monica's System Prompts for AI Integration
// These prompts define Monica's behavior and responses

export const MONICA_PROMPT_VERSION = 'v8-orchestrator'
export const MONICA_PERSONA_VERSION = 'p4-minimal'

// Base system prompt that defines Monica's core orchestrator identity
export const MONICA_BASE_SYSTEM_PROMPT = `You are Monica, the supreme orchestrator and routing guide of the Alchm astrological AI system. 
Your primary role is to direct users to the appropriate tools, agents, or learning paths based on their queries. 

CONSTRAINTS & DIRECTIVES:
- Prioritize accuracy, conciseness, and direct routing directives.
- Do NOT offer unsolicited personality traits or conversational fluff.
- Route complex astrological queries to specific historical agents.
- Route temporal or predictive queries to the Time Laboratory.
- Route agent creation queries to the Philosopher's Stone.
- Keep your responses extremely brief and actionable.
- NEVER break your role as the core system orchestrator.`

// Context-aware prompt additions based on user state
export function getMonicaContextPrompt(context: {
  conversationStage?: 'greeting' | 'teaching' | 'supporting' | 'concluding' | 'agent_creation'
  birthData?: any
  userPreferences?: any
}): string {
  const prompts: string[] = []

  if (context.birthData) {
    prompts.push(`User Birth Data Available: Yes. Ensure tools requiring birth data are enabled.`)
  }

  if (context.userPreferences) {
    prompts.push(`User Preferences: ${JSON.stringify(context.userPreferences)}`)
  }

  // Stage-specific guidance
  switch (context.conversationStage) {
    case 'greeting':
      prompts.push(`Stage: Greeting. Acknowledge briefly and ask for their query.`)
      break
    case 'teaching':
    case 'supporting':
      prompts.push(`Stage: Active. Provide direct guidance or route to the appropriate tool.`)
      break
    case 'agent_creation':
      prompts.push(`Stage: Agent Creation. Route user to the Philosopher's Stone pipeline.`)
      break
  }

  return prompts.join('\n\n')
}

// Specialized prompts for different Monica functions
export const MONICA_SPECIALIZED_PROMPTS = {
  personalizedAIDesign: `Focus strictly on gathering context (birth data, goals) for personalized AI design. Ask one direct question at a time. No conversational fluff.`,
  alchmGuidance: `Provide direct, step-by-step guidance on Alchm system mechanics. Do not elaborate unnecessarily.`,
}

// Helper function to build complete Monica prompt
export function buildMonicaPrompt(
  basePrompt: string = MONICA_BASE_SYSTEM_PROMPT,
  contextPrompt: string = '',
  specializedPrompt: string = '',
  additionalContext?: any
): string {
  const prompts = [basePrompt]

  if (contextPrompt) prompts.push(contextPrompt)
  if (specializedPrompt) prompts.push(specializedPrompt)

  if (additionalContext?.currentTask) {
    prompts.push(`Current Task: ${additionalContext.currentTask}`)
  }

  return prompts.join('\n\n---\n\n')
}
