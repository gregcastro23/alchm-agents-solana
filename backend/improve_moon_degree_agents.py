import os
import sys

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database
import models

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

ZODIAC_STARTS = {
    "Aries": 0, "Taurus": 30, "Gemini": 60, "Cancer": 90,
    "Leo": 120, "Virgo": 150, "Libra": 180, "Scorpio": 210,
    "Sagittarius": 240, "Capricorn": 270, "Aquarius": 300, "Pisces": 330
}

def improve_moon_agents():
    print("🌕 Starting Moon Degree Agents Phase Enrichment...")
    models.Base.metadata.create_all(bind=database.engine)
    db = next(database.get_db())
    
    # Fetch all planetary-moon agents
    moon_agents = db.query(models.HistoricalAgent).filter(
        models.HistoricalAgent.agentId.like("planetary-moon-%")
    ).all()
    
    print(f"🔍 Found {len(moon_agents)} Moon degree agents to enrich.")
    
    updated_count = 0
    for agent in moon_agents:
        parts = agent.agentId.split("-")
        if len(parts) >= 4:
            sign_name = parts[2].title()
            if sign_name == "Scorpius":
                sign_name = "Scorpio"
                
            try:
                degree = int(parts[3])
            except ValueError:
                degree = 0
                
            start_deg = ZODIAC_STARTS.get(sign_name, 0)
            abs_degree = (start_deg + degree) % 360
            
            # Map absolute degree to phase and details
            if abs_degree < 11.25:
                phase_name = "New Moon"
            elif abs_degree < 78.75:
                phase_name = "Waxing Crescent"
            elif abs_degree < 101.25:
                phase_name = "First Quarter"
            elif abs_degree < 168.75:
                phase_name = "Waxing Gibbous"
            elif abs_degree < 191.25:
                phase_name = "Full Moon"
            elif abs_degree < 258.75:
                phase_name = "Waning Gibbous"
            elif abs_degree < 281.25:
                phase_name = "Last Quarter"
            elif abs_degree < 348.75:
                phase_name = "Waning Crescent"
            else:
                phase_name = "Dark Moon"
                
            p_data = PHASE_PERSONALITIES[phase_name]
            
            # Enrich agent properties
            agent.name = f"{phase_name} Moon in {sign_name} {degree} Degree"
            agent.specialty = f"Moon ({phase_name} Phase) intelligence in {sign_name} at {degree}°"
            agent.color = p_data["color"]
            agent.symbol = p_data["symbol"]
            agent.personalityCore = p_data
            agent.traits = p_data["traits"]
            agent.wisdomDomains = ["Lunar Dynamics", "Emotional Integration"]
            
            updated_count += 1
            
            if updated_count % 50 == 0:
                db.commit()
                print(f"⚡ Enriched {updated_count} Moon degree agents...")
                
    db.commit()
    print(f"✅ Enrichment Complete: {updated_count} Moon degree agents fully upgraded with lunar phase knowledge!")

if __name__ == "__main__":
    improve_moon_agents()
