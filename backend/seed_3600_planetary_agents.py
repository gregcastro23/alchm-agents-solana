import os
import sys
from datetime import datetime
import uuid

# Add the current directory to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database
import models
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

def seed_3600():
    print("🌌 Starting 3,600+ Planetary Agents Seeding...")
    models.Base.metadata.create_all(bind=database.engine)
    database.ensure_postgres_runtime_schema()
    db = next(database.get_db())
    
    # Pre-fetch existing agent IDs to prevent duplicate inserts
    print("🔍 Fetching existing agent IDs from database...")
    existing_agents = {r[0] for r in db.query(models.HistoricalAgent.agentId).all()}
    print(f"ℹ️ Found {len(existing_agents)} existing agents in database.")
    
    new_agents_count = 0
    batch_size = 500
    
    for planet in PLANETS:
        print(f"🪐 Processing {planet}...")
        for sign in SIGNS:
            for degree in range(30):
                agent_id = f"planetary-{planet.lower()}-{sign.lower()}-{degree}"
                
                if agent_id in existing_agents:
                    continue
                
                element = utils.get_zodiac_element(sign)
                modality = SIGN_MODALITIES.get(sign, "Cardinal")
                color = PLANET_COLORS.get(planet, "#8b5cf6")
                
                dignity_val = utils.get_planetary_dignity(planet, sign)
                if dignity_val in (1, 3):
                    ruler_dignity = "domicile"
                elif dignity_val == 2:
                    ruler_dignity = "exaltation"
                elif dignity_val in (-1, -3):
                    ruler_dignity = "detriment"
                elif dignity_val == -2:
                    ruler_dignity = "fall"
                else:
                    ruler_dignity = "peregrine"
                    
                is_anaretic = (degree == 29)
                is_cardinal_degree = (degree == 0 and modality == "Cardinal")
                critical_degrees = {
                    "Cardinal": [0, 13, 26],
                    "Fixed": [8, 9, 21, 22],
                    "Mutable": [4, 17]
                }
                is_critical_degree = degree in critical_degrees.get(modality, [])
                
                # Consciousness level calculation
                level_score = 3
                if ruler_dignity == "domicile":
                    level_score += 2
                elif ruler_dignity == "exaltation":
                    level_score += 3
                elif ruler_dignity == "detriment":
                    level_score -= 1
                elif ruler_dignity == "fall":
                    level_score -= 2
                    
                if is_anaretic:
                    level_score += 2
                if is_cardinal_degree:
                    level_score += 1
                if is_critical_degree:
                    level_score += 1
                    
                if degree == 0:
                    level_score += 1
                if degree == 29:
                    level_score += 1
                    
                if level_score >= 7:
                    consciousness_level = "Transcendent"
                elif level_score >= 6:
                    consciousness_level = "Illuminated"
                elif level_score >= 5:
                    consciousness_level = "Advanced"
                elif level_score >= 4:
                    consciousness_level = "Elevated"
                elif level_score >= 3:
                    consciousness_level = "Active"
                elif level_score >= 2:
                    consciousness_level = "Awakening"
                else:
                    consciousness_level = "Dormant"
                    
                # Power level calculation
                power = 0.5
                if ruler_dignity == "domicile":
                    power += 0.3
                elif ruler_dignity == "exaltation":
                    power += 0.4
                elif ruler_dignity == "detriment":
                    power -= 0.2
                elif ruler_dignity == "fall":
                    power -= 0.3
                    
                if is_critical_degree:
                    power += 0.15
                if degree == 0:
                    power += 0.1
                if degree == 29:
                    power += 0.15
                if modality == "Fixed":
                    power += 0.05
                power_level = max(0.0, min(1.0, power))
                
                name_str = f"{planet} in {sign} {degree} Degree"
                specialty = f"{planet} intelligence in {sign} at {degree}°"
                
                agent_data = {
                    "id": str(uuid.uuid4()),
                    "agentId": agent_id,
                    "name": name_str,
                    "title": "Planetary Intelligence",
                    "birthDate": datetime(2000, 1, 1),
                    "birthTime": "12:00",
                    "birthLocation": {"lat": 0.0, "lon": 0.0, "name": "Unknown"},
                    "birthYear": 2000,
                    "consciousnessLevel": consciousness_level,
                    "monicaConstant": power_level,
                    "kalchmConstant": power_level,
                    "dominantElement": element,
                    "dominantModality": modality,
                    "specialty": specialty,
                    "wisdomDomains": ["Cosmology", "Planetary Influence"],
                    "avatar": "",
                    "color": color,
                    "symbol": planet,
                    "signature": f"{agent_id}-synced-agent",
                    "personalityCore": {},
                    "personalityShadows": [],
                    "personalityGifts": [],
                    "personalityChallenges": [],
                    "currentMood": "Curious",
                    "background": {},
                    "skills": [],
                    "teachingStyle": "Reflective dialogue",
                    "resonanceType": "general",
                    "uniquePower": "Contextual wisdom",
                    "natalChart": {},
                    "traits": [],
                    "historicalEra": "modern_pre1950",
                    "culture": "Modern International",
                    "geography": "Modern World",
                    "lastActive": datetime.utcnow(),
                    "isActive": True,
                    "version": "2.0.0",
                    "craftedBy": "philosopher-stone"
                }
                
                db_agent = models.HistoricalAgent(**agent_data)
                db.add(db_agent)
                new_agents_count += 1
                
                # Commit in batches to manage transaction size and memory footprint
                if new_agents_count % batch_size == 0:
                    db.commit()
                    print(f"⚡ Committed batch of {batch_size} agents (Total created: {new_agents_count})")
                    
    if new_agents_count % batch_size != 0:
        db.commit()
        
    print(f"✅ Seeding Complete: {new_agents_count} new degree-level planetary agents created!")

if __name__ == "__main__":
    seed_3600()
