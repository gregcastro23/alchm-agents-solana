import { buildAgentContext } from '../lib/agents/persona/build-agent-context'

const ids = ['socrates', 'albert-einstein', 'voltaire', 'hildegard-of-bingen', 'paulo-freire']
for (const id of ids) {
  const ctx = buildAgentContext(id)
  if (!ctx) {
    console.log('MISS:', id)
    continue
  }
  console.log('==========', id, '/ cacheKey:', ctx.cacheKey, '==========')
  console.log('Total length:', ctx.personaBlock.length, 'chars')
  // Extract the Communication Style section to verify Sacred 7 Stats wiring
  const styleStart = ctx.personaBlock.indexOf('## Your Communication Style')
  const styleEnd = ctx.personaBlock.indexOf('##', styleStart + 5)
  if (styleStart >= 0) {
    console.log('--- Sacred 7 Stats section ---')
    console.log(ctx.personaBlock.slice(styleStart, styleEnd >= 0 ? styleEnd : styleStart + 1500))
  } else {
    console.log('!! No Communication Style section found !!')
  }
  console.log()
}
