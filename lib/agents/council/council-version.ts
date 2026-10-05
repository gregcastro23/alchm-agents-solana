// Keep publication/cache identity sensitive to editorial and model-routing changes.
// Bump the relevant component whenever its prompts, knowledge, or routing change.
export const PLACEMENT_KNOWLEDGE_VERSION = 'western-symbolism-v2'
export const COUNCIL_PERSONA_VERSION = 'educational-council-v2'
export const DAILY_COUNCIL_VERSION = `daily-council-v2:${COUNCIL_PERSONA_VERSION}:${PLACEMENT_KNOWLEDGE_VERSION}:routing-v1`
