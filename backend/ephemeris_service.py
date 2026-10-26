"""
Swiss Ephemeris Service and API Endpoints (FastAPI)
===================================================

Provides high-accuracy astronomical calculations using Swiss Ephemeris (via pyswisseph)
for planetary positions, house systems, and consciousness parameters.

Endpoints:
- POST /api/planets/positions
- POST /api/planets/batch-positions
- POST /api/planets/houses
- POST /api/planets/calculate
- GET  /api/planets/available
"""

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import swisseph as swe
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# Planet constants mapped to pyswisseph IDs
PLANETS: Dict[str, int] = {
    "sun": swe.SUN,
    "moon": swe.MOON,
    "mercury": swe.MERCURY,
    "venus": swe.VENUS,
    "mars": swe.MARS,
    "jupiter": swe.JUPITER,
    "saturn": swe.SATURN,
    "uranus": swe.URANUS,
    "neptune": swe.NEPTUNE,
    "pluto": swe.PLUTO,
    "north-node": swe.TRUE_NODE,
    "chiron": swe.CHIRON,
}

# Planetary alchemy correspondences
PLANETARY_ALCHEMY: Dict[str, Dict[str, Any]] = {
    "sun": {"spirit": 1.0, "essence": 0.0, "matter": 0.0, "substance": 0.0, "element": "fire"},
    "moon": {"spirit": 0.0, "essence": 1.0, "matter": 1.0, "substance": 0.0, "element": "water"},
    "mercury": {"spirit": 1.0, "essence": 0.0, "matter": 0.0, "substance": 1.0, "element": "air"},
    "venus": {"spirit": 0.0, "essence": 1.0, "matter": 1.0, "substance": 0.0, "element": "water"},
    "mars": {"spirit": 0.0, "essence": 0.0, "matter": 1.0, "substance": 1.0, "element": "fire"},
    "jupiter": {"spirit": 0.0, "essence": 1.0, "matter": 0.0, "substance": 0.0, "element": "air"},
    "saturn": {"spirit": 0.0, "essence": 0.0, "matter": 0.0, "substance": 1.0, "element": "earth"},
    "uranus": {"spirit": 1.0, "essence": 0.0, "matter": 0.0, "substance": 0.0, "element": "air"},
    "neptune": {"spirit": 0.0, "essence": 1.0, "matter": 0.0, "substance": 0.0, "element": "water"},
    "pluto": {"spirit": 0.0, "essence": 0.0, "matter": 1.0, "substance": 0.0, "element": "earth"},
}


# --- Request & Response Models ---

class PositionsRequest(BaseModel):
    date: str = Field(..., description="ISO 8601 date string")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    planets: Optional[List[str]] = Field(None, description="Array of planet keys to compute")


class BatchPositionItem(BaseModel):
    date: str
    planet: str


class BatchPositionsRequest(BaseModel):
    requests: List[BatchPositionItem]


class HousesRequest(BaseModel):
    date: str = Field(..., description="ISO 8601 date string")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    houseSystem: Optional[str] = Field("P", description="Single char house system code, default 'P'")


class BirthData(BaseModel):
    date: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ConsciousnessRequest(BaseModel):
    birthData: BirthData
    currentDate: Optional[str] = None


# --- Calculation Helpers ---

def parse_iso_date(date_str: str) -> tuple[datetime, float]:
    """Parse ISO8601 date string into UTC datetime and Julian Day number."""
    try:
        normalized = date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ISO 8601 date: {date_str} ({e})")

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    else:
        dt = dt.replace(tzinfo=timezone.utc)

    decimal_hour = dt.hour + dt.minute / 60.0 + dt.second / 3600.0 + dt.microsecond / 3600000000.0
    jd = swe.julday(dt.year, dt.month, dt.day, decimal_hour, swe.GREG_CAL)
    return dt, jd


def calculate_single_planet(planet_id: int, jd: float) -> Dict[str, float]:
    """Calculate planet position using Swiss Ephemeris MOSHIER mode with speed."""
    flags = swe.FLG_MOSEPH | swe.FLG_SPEED
    res, _ = swe.calc_ut(jd, planet_id, flags)
    return {
        "longitude": float(res[0]),
        "latitude": float(res[1]),
        "distance": float(res[2]),
        "speed": float(res[3]),
    }


def compute_positions_dict(jd: float, requested_planets: Optional[List[str]] = None) -> Dict[str, Dict[str, float]]:
    targets = requested_planets if requested_planets else list(PLANETS.keys())
    positions: Dict[str, Dict[str, float]] = {}

    for name in targets:
        k = name.lower()
        if k not in PLANETS:
            continue
        pid = PLANETS[k]
        try:
            positions[k] = calculate_single_planet(pid, jd)
        except Exception:
            # Skip unsupported bodies under Moshier (e.g. Chiron) without failing the batch
            continue

    return positions


def compute_house_system(jd: float, latitude: float, longitude: float, house_system: str = "P") -> Dict[str, Any]:
    code = (house_system or "P")[0].encode("ascii")
    try:
        cusps, ascmc = swe.houses(jd, latitude, longitude, code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"House system calculation failed: {e}")

    return {
        "houses": [float(c) for c in cusps],
        "ascendant": float(ascmc[0]),
        "mc": float(ascmc[1]),
    }


# --- API Routes ---

@router.post("/positions")
async def post_planetary_positions(payload: PositionsRequest):
    start = time.perf_counter()
    dt, jd = parse_iso_date(payload.date)
    positions = compute_positions_dict(jd, payload.planets)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return {
        "success": True,
        "data": positions,
        "metadata": {
            "computeTime": elapsed_ms,
            "requestDate": dt.isoformat(),
            "totalPlanets": len(positions),
            "coordinates": (
                {"latitude": payload.latitude, "longitude": payload.longitude}
                if payload.latitude is not None and payload.longitude is not None
                else None
            ),
        },
    }


@router.post("/batch-positions")
async def post_batch_planetary_positions(payload: BatchPositionsRequest):
    start = time.perf_counter()
    results = []

    for req_item in payload.requests:
        _, jd = parse_iso_date(req_item.date)
        k = req_item.planet.lower()
        pos = None
        if k in PLANETS:
            try:
                pos = calculate_single_planet(PLANETS[k], jd)
            except Exception:
                pos = None
        results.append({
            "date": req_item.date,
            "planet": req_item.planet,
            "position": pos,
        })

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "success": True,
        "data": results,
        "metadata": {
            "computeTime": elapsed_ms,
            "totalRequests": len(payload.requests),
        },
    }


@router.post("/houses")
async def post_houses(payload: HousesRequest):
    start = time.perf_counter()
    dt, jd = parse_iso_date(payload.date)
    hsys = payload.houseSystem or "P"
    houses_data = compute_house_system(jd, payload.latitude, payload.longitude, hsys)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return {
        "success": True,
        "data": houses_data,
        "metadata": {
            "computeTime": elapsed_ms,
            "requestDate": dt.isoformat(),
            "coordinates": {"latitude": payload.latitude, "longitude": payload.longitude},
            "houseSystem": hsys,
        },
    }


@router.post("/calculate")
async def post_consciousness_calculate(payload: ConsciousnessRequest):
    start = time.perf_counter()
    birth_dt, _ = parse_iso_date(payload.birthData.date)
    transit_dt, transit_jd = parse_iso_date(payload.currentDate) if payload.currentDate else (
        datetime.now(timezone.utc),
        swe.julday(
            datetime.now(timezone.utc).year,
            datetime.now(timezone.utc).month,
            datetime.now(timezone.utc).day,
            datetime.now(timezone.utc).hour + datetime.now(timezone.utc).minute / 60.0 + datetime.now(timezone.utc).second / 3600.0,
            swe.GREG_CAL,
        )
    )

    positions = compute_positions_dict(transit_jd)

    total_spirit = 0.0
    total_essence = 0.0
    total_matter = 0.0
    total_substance = 0.0
    influences = {}

    for planet_name, pos in positions.items():
        alchemy = PLANETARY_ALCHEMY.get(planet_name)
        if not alchemy:
            continue

        speed_factor = 1.5 if pos["speed"] < 0 else 1.0
        strength = (1.0 / (abs(pos["speed"]) + 0.1)) * speed_factor
        total_spirit += alchemy["spirit"] * strength
        total_essence += alchemy["essence"] * strength
        total_matter += alchemy["matter"] * strength
        total_substance += alchemy["substance"] * strength
        influences[planet_name] = {"element": alchemy["element"], "strength": strength}

    total_sum = total_spirit + total_essence + total_matter + total_substance or 1.0
    phi = 1.618033988749895
    norm_spirit = total_spirit / total_sum
    norm_essence = total_essence / total_sum
    norm_matter = total_matter / total_sum
    norm_substance = total_substance / total_sum

    monica = (norm_spirit * phi + norm_essence) / (norm_matter + norm_substance + 1.0)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return {
        "success": True,
        "data": {
            "spirit": norm_spirit,
            "essence": norm_essence,
            "matter": norm_matter,
            "substance": norm_substance,
            "monicaConstant": monica,
            "planetaryInfluences": influences,
        },
        "metadata": {
            "computeTime": elapsed_ms,
            "birthDate": birth_dt.isoformat(),
            "transitDate": transit_dt.isoformat(),
            "coordinates": (
                {"latitude": payload.birthData.latitude, "longitude": payload.birthData.longitude}
                if payload.birthData.latitude is not None and payload.birthData.longitude is not None
                else None
            ),
        },
    }


@router.get("/available")
async def get_available_planets():
    available = [
        {"id": "sun", "name": "Sun", "element": "fire", "alchemy": {"spirit": 1, "essence": 0, "matter": 0, "substance": 0}},
        {"id": "moon", "name": "Moon", "element": "water", "alchemy": {"spirit": 0, "essence": 1, "matter": 1, "substance": 0}},
        {"id": "mercury", "name": "Mercury", "element": "air", "alchemy": {"spirit": 1, "essence": 0, "matter": 0, "substance": 1}},
        {"id": "venus", "name": "Venus", "element": "water", "alchemy": {"spirit": 0, "essence": 1, "matter": 1, "substance": 0}},
        {"id": "mars", "name": "Mars", "element": "fire", "alchemy": {"spirit": 0, "essence": 0, "matter": 1, "substance": 1}},
        {"id": "jupiter", "name": "Jupiter", "element": "air", "alchemy": {"spirit": 0, "essence": 1, "matter": 0, "substance": 0}},
        {"id": "saturn", "name": "Saturn", "element": "earth", "alchemy": {"spirit": 0, "essence": 0, "matter": 0, "substance": 1}},
        {"id": "uranus", "name": "Uranus", "element": "air", "alchemy": {"spirit": 1, "essence": 0, "matter": 0, "substance": 0}},
        {"id": "neptune", "name": "Neptune", "element": "water", "alchemy": {"spirit": 0, "essence": 1, "matter": 0, "substance": 0}},
        {"id": "pluto", "name": "Pluto", "element": "earth", "alchemy": {"spirit": 0, "essence": 0, "matter": 1, "substance": 0}},
        {"id": "north-node", "name": "North Node", "element": "spirit", "alchemy": {"spirit": 1, "essence": 0, "matter": 0, "substance": 0}},
        {"id": "chiron", "name": "Chiron", "element": "hybrid", "alchemy": {"spirit": 0, "essence": 1, "matter": 1, "substance": 0}},
    ]
    return {
        "success": True,
        "data": available,
        "metadata": {
            "total": len(available),
            "alchemicalPrinciple": "Each planet carries specific alchemical energies (Spirit, Essence, Matter, Substance)",
        },
    }
