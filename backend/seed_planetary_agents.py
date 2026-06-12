import os
import sys
from datetime import datetime

# Add the current directory to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database
import crud
import schemas
import utils

PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

PLANET_COLORS = {
    "Sun": "#f59e0b",
    "Moon": "#3b82f6",
    "Mercury": "#10b981",
    "Venus": "#ec4899",
    "Mars": "#ef4444",
    "Jupiter": "#8b5cf6",
    "Saturn": "#4b5563",
    "Uranus": "#06b6d4",
    "Neptune": "#6366f1",
    "Pluto": "#7c3aed"
}

SIGN_MODALITIES = {
    "Aries": "Cardinal", "Libra": "Cardinal", "Cancer": "Cardinal", "Capricorn": "Cardinal",
    "Taurus": "Fixed", "Leo": "Fixed", "Scorpio": "Fixed", "Aquarius": "Fixed",
    "Gemini": "Mutable", "Virgo": "Mutable", "Sagittarius": "Mutable", "Pisces": "Mutable"
}

def seed_planetary():
    print("🌌 Seeding 120 Planetary Agents...")
    db = next(database.get_db())
    
    seeded_count = 0
    skipped_count = 0
    
    for planet in PLANETS:
        for sign in SIGNS:
            agent_id = f"{planet.lower()}-{sign.lower()}"
            
            # Check if agent already exists
            db_agent = crud.get_agent(db, agent_id=agent_id)
            if db_agent:
                skipped_count += 1
                continue
                
            element = utils.get_zodiac_element(sign)
            modality = SIGN_MODALITIES.get(sign, "Cardinal")
            color = PLANET_COLORS.get(planet, "#8b5cf6")
            
            try:
                agent_create = schemas.AgentCreate(
                    agentId=agent_id,
                    name=f"{planet} in {sign}",
                    title="Planetary Intelligence",
                    birthDate=datetime(2000, 1, 1),
                    birthTime="12:00",
                    birthLocation=schemas.BirthLocation(lat=0.0, lon=0.0, name="Unknown"),
                    consciousnessLevel="Active",
                    monicaConstant=0.5,
                    dominantElement=element,
                    dominantModality=modality,
                    specialty=f"{planet} intelligence in {sign}",
                    wisdomDomains=["Cosmology", "Planetary Influence"],
                    avatar="",
                    color=color,
                    symbol=planet
                )
                crud.create_agent(db=db, agent=agent_create)
                seeded_count += 1
            except Exception as err:
                print(f"❌ Failed to seed {agent_id}: {err}")
                db.rollback()
                
    print(f"✅ Seeding Complete: {seeded_count} agents created, {skipped_count} already existed.")

if __name__ == "__main__":
    seed_planetary()
