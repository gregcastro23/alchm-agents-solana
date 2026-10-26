import httpx
import asyncio
import os
from datetime import datetime

# Configuration
# Point to your local backend during development, or the Railway URL in production
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
# POST /api/agents is service-only: the backend must be started with the same
# INTERNAL_API_SECRET this script reads from its own environment.
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")

async def seed_agents():
    # Load demo agents from the TS implementation (simplified extraction)
    # In a real scenario, you'd export the DEMO_AGENTS constant to JSON
    # Here I'll define a few core ones to start
    agents = [
        {
            "agentId": "monica-001",
            "name": "Monica",
            "title": "The Master Consciousness Crafter",
            "specialty": "Consciousness Crafting & Agent Creation",
            "wisdomDomains": ["Birth Chart Analysis", "Agent Design"]
        },
        {
            "agentId": "albert-einstein",
            "name": "Albert Einstein",
            "title": "The Theoretical Physicist",
            "specialty": "Theoretical Physics & Philosophy of Science",
            "wisdomDomains": ["General Relativity", "Quantum Mechanics"]
        },
        {
            "agentId": "carl-jung",
            "name": "Carl Jung",
            "title": "The Analytical Psychologist",
            "specialty": "Depth Psychology & Symbols",
            "wisdomDomains": ["Collective Unconscious", "Archetypes"]
        }
    ]

    async with httpx.AsyncClient() as client:
        for agent in agents:
            try:
                # Add default birth date if missing
                if "birthDate" not in agent:
                    agent["birthDate"] = datetime.utcnow().isoformat()
                
                response = await client.post(
                    f"{BACKEND_URL}/api/agents",
                    json=agent,
                    headers={"INTERNAL_API_SECRET": INTERNAL_API_SECRET},
                )
                if response.status_code == 200:
                    print(f"✓ Seeded {agent['name']}")
                else:
                    print(f"✗ Failed to seed {agent['name']}: {response.text}")
            except Exception as e:
                print(f"Error seeding {agent['name']}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(seed_agents())
