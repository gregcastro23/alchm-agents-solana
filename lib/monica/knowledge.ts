// Curated micro-snippets for compact RAG-like injection

export type KnowledgeBlock = {
  id: string
  version: string
  tags: string[]
  content: string
}

export const KNOWLEDGE_BLOCKS: KnowledgeBlock[] = [
  {
    id: 'elemental-logic-v1',
    version: 'v1',
    tags: ['elemental', 'compatibility', 'rules'],
    content: `Elemental compatibility: same-element=0.9, different=0.7. No opposites or balancing pairs; like reinforces like. Treat elements as independently valuable.`,
  },
  {
    id: 'tarot-quick-facts-v1',
    version: 'v1',
    tags: ['tarot', 'quick-facts'],
    content: `Tarot quick facts: Wands=Fire, Cups=Water, Swords=Air, Pentacles=Earth. Use concise, practical interpretations with 1 actionable takeaway.`,
  },
]

export function selectKnowledge(tags: string[]): KnowledgeBlock[] {
  return KNOWLEDGE_BLOCKS.filter(b => b.tags.some(t => tags.includes(t)))
}
