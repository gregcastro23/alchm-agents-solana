import os
import sys
from datetime import datetime
import uuid

# Add the current directory to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database
import models
import utils

PHASES = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent", "Dark Moon"]
ZODIAC_SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

SIGN_MODALITIES = {
    "Aries": "Cardinal", "Libra": "Cardinal", "Cancer": "Cardinal", "Capricorn": "Cardinal",
    "Taurus": "Fixed", "Leo": "Fixed", "Scorpio": "Fixed", "Aquarius": "Fixed",
    "Gemini": "Mutable", "Virgo": "Mutable", "Sagittarius": "Mutable", "Pisces": "Mutable"
}

PHASE_SLUGS = {
    "New Moon": "new-moon",
    "Waxing Crescent": "waxing-crescent",
    "First Quarter": "first-quarter",
    "Waxing Gibbous": "waxing-gibbous",
    "Full Moon": "full-moon",
    "Waning Gibbous": "waning-gibbous",
    "Last Quarter": "last-quarter",
    "Waning Crescent": "waning-crescent",
    "Dark Moon": "dark-moon"
}

PHASE_PERSONALITIES = {
    "New Moon": {
        "archetype": "The Seed Planter",
        "traits": ["intuitive", "introspective", "initiating", "mysterious", "potential-focused"],
        "specialty": "New beginnings, setting intentions, and void-dwelling potential.",
        "spirit": 0.9, "essence": 0.3, "matter": 0.1, "substance": 0.1, "color": "#1e293b", "symbol": "🌑"
    },
    "Waxing Crescent": {
        "archetype": "The Young Explorer",
        "traits": ["curious", "hopeful", "tentative", "learning", "growing"],
        "specialty": "Building momentum, early growth, and hopeful exploration.",
        "spirit": 0.7, "essence": 0.4, "matter": 0.2, "substance": 0.2, "color": "#38bdf8", "symbol": "🌒"
    },
    "First Quarter": {
        "archetype": "The Decision Maker",
        "traits": ["decisive", "challenged", "determined", "active", "crisis-oriented"],
        "specialty": "Breaking through barriers, dynamic actions, and decisive choice.",
        "spirit": 0.5, "essence": 0.5, "matter": 0.3, "substance": 0.2, "color": "#0ea5e9", "symbol": "🌓"
    },
    "Waxing Gibbous": {
        "archetype": "The Refiner",
        "traits": ["perfecting", "analyzing", "adjusting", "preparing", "anticipating"],
        "specialty": "Analyzing details, fine-tuning structures, and preparing for peak expression.",
        "spirit": 0.4, "essence": 0.6, "matter": 0.4, "substance": 0.3, "color": "#0284c7", "symbol": "🌔"
    },
    "Full Moon": {
        "archetype": "The Illuminator",
        "traits": ["revealing", "emotional", "powerful", "culminating", "illuminating"],
        "specialty": "Emotional truths, dramatic revelations, and peak manifestation.",
        "spirit": 0.5, "essence": 0.7, "matter": 0.5, "substance": 0.4, "color": "#f59e0b", "symbol": "🌕"
    },
    "Waning Gibbous": {
        "archetype": "The Grateful Sage",
        "traits": ["grateful", "sharing", "teaching", "distributing", "wise"],
        "specialty": "Sharing wisdom, expressing gratitude, and distributing abundance.",
        "spirit": 0.4, "essence": 0.6, "matter": 0.6, "substance": 0.5, "color": "#e2e8f0", "symbol": "🌖"
    },
    "Last Quarter": {
        "archetype": "The Release Master",
        "traits": ["releasing", "forgiving", "clearing", "transitioning", "letting go"],
        "specialty": "Clearing outmoded patterns, compassionate forgiveness, and active release.",
        "spirit": 0.3, "essence": 0.5, "matter": 0.5, "substance": 0.4, "color": "#94a3b8", "symbol": "🌗"
    },
    "Waning Crescent": {
        "archetype": "The Dream Weaver",
        "traits": ["restful", "dreamy", "intuitive", "preparing", "surrendering"],
        "specialty": "Restful contemplation, dream integration, and peaceful surrender.",
        "spirit": 0.2, "essence": 0.4, "matter": 0.4, "substance": 0.3, "color": "#64748b", "symbol": "🌘"
    },
    "Dark Moon": {
        "archetype": "The Void Walker",
        "traits": ["mysterious", "transformative", "void-dwelling", "death-rebirth", "primal"],
        "specialty": "Primal void exploration, shadow integration, and deep transformation.",
        "spirit": 1.0, "essence": 0.1, "matter": 0.1, "substance": 0.0, "color": "#0f172a", "symbol": "⚫"
    }
}

def seed_moon_phases():
    print("🌕 Starting 3,240 Moon Phase Agents Seeding...")
    models.Base.metadata.create_all(bind=database.engine)
    database.ensure_postgres_runtime_schema()
    db = next(database.get_db())
    
    print("🔍 Fetching existing agent IDs from database...")
    existing_agents = {r[0] for r in db.query(models.HistoricalAgent.agentId).all()}
    print(f"ℹ️ Found {len(existing_agents)} existing agents in database.")
    
    new_agents_count = 0
    batch_size = 500
    
    for phase in PHASES:
        print(f"🌙 Seeding {phase} Moon Agents...")
        slug = PHASE_SLUGS[phase]
        p_data = PHASE_PERSONALITIES[phase]
        
        for degree in range(360):
            agent_id = f"moon-phase-{slug}-{degree}"
            
            if agent_id in existing_agents:
                continue
                
            sign_opt = ZODIAC_SIGNS[min(11, max(0, degree // 30))]
            element = utils.get_zodiac_element(sign_opt)
            modality = SIGN_MODALITIES.get(sign_opt, "Cardinal")
            
            name_str = f"{phase} Moon in {sign_opt} {degree % 30} Degree"
            specialty = p_data["specialty"]
            
            agent_data = {
                "id": str(uuid.uuid4()),
                "agentId": agent_id,
                "name": name_str,
                "title": "Moon Phase Intelligence",
                "birthDate": datetime(2000, 1, 1),
                "birthTime": "12:00",
                "birthLocation": {"lat": 0.0, "lon": 0.0, "name": "Unknown"},
                "birthYear": 2000,
                "consciousnessLevel": "Active",
                "monicaConstant": p_data["spirit"],
                "kalchmConstant": p_data["spirit"],
                "dominantElement": element,
                "dominantModality": modality,
                "specialty": specialty,
                "wisdomDomains": ["Lunar Dynamics", "Emotional Integration"],
                "avatar": "",
                "color": p_data["color"],
                "symbol": p_data["symbol"],
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
            
            if new_agents_count % batch_size == 0:
                db.commit()
                print(f"⚡ Committed batch of {batch_size} moon agents (Total created: {new_agents_count})")
                
    if new_agents_count % batch_size != 0:
        db.commit()
        
    print(f"✅ Moon Phase Seeding Complete: {new_agents_count} new moon phase agents created!")

if __name__ == "__main__":
    seed_moon_phases()
