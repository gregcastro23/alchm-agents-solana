import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { DEMO_AGENTS } from '../lib/demo-agents-data'

async function main() {
  console.log('Seeding local Python backend on port 8000...')
  for (const agent of DEMO_AGENTS) {
    // Sanitize birth date
    const birthDateStr = isNaN(agent.birthData.date.getTime())
      ? new Date('1970-01-01T12:00:00Z').toISOString()
      : agent.birthData.date.toISOString()

    const payload = {
      agentId: agent.id,
      name: agent.name,
      title: agent.title,
      specialty: agent.abilities.specialty,
      wisdomDomains: agent.abilities.wisdomDomains,
      birthDate: birthDateStr,
      birthTime: agent.birthData.time,
      birthLocation: agent.birthData.location,
      monicaConstant: agent.consciousness.monicaConstant,
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        console.log(`✓ Seeded ${agent.name}`)
      } else {
        const text = await response.text()
        if (text.includes('already registered')) {
          console.log(`- ${agent.name} already registered`)
        } else {
          console.log(`✗ Failed ${agent.name}: ${text}`)
        }
      }
    } catch (e) {
      console.error(`Error for ${agent.name}:`, e)
    }
  }
}

main()
  .then(() => console.log('Seeding complete!'))
  .catch(console.error)
