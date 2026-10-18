"""
Autonomous Fourteen Alchemical Pillars duel engine.

Python port of lib/pillar-agent-duel.ts and lib/alchemical-circuit.ts,
grounded in the canonical specification at spec/pillars.v1.json (mirrored by
alchm-astro-core/src/pillars.rs and alchm-astro-core/tools/pillar_sim.py).

Provides best-response calculations and in-character voice lines for the
Pentacles Fourteen Pillars Arena companion endpoint.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Spec loading
# ---------------------------------------------------------------------------

_SPEC_PATHS = [
    Path(__file__).resolve().parent / "pillars.v1.json",
    Path(__file__).resolve().parent.parent / "alchm-astro-core" / "spec" / "pillars.v1.json",
]

SPEC: Dict[str, Any] = {}
for path in _SPEC_PATHS:
    if path.exists():
        try:
            SPEC = json.loads(path.read_text(encoding="utf-8"))
            break
        except Exception:
            continue

if not SPEC:
    raise RuntimeError(f"Could not load pillars.v1.json from any candidate path: {[str(p) for p in _SPEC_PATHS]}")

C = SPEC["constants"]
SIGNS = SPEC["conventions"]["signOrder"]
ELEMENTS = ["Fire", "Earth", "Air", "Water"]  # sign index % 4
MODALITIES = ["Cardinal", "Fixed", "Mutable"]  # sign index % 3
PILLARS = SPEC["pillars"]
BY_ID: Dict[int, Dict[str, Any]] = {p["id"]: p for p in PILLARS}
BY_KEY: Dict[str, Dict[str, Any]] = {p["key"].lower(): p for p in PILLARS}
BY_NAME: Dict[str, Dict[str, Any]] = {p["name"].lower(): p for p in PILLARS}

ALCHEMY: List[List[float]] = [p["alchemy"] for p in SPEC["natal"]["planets"]]
DIGNITY: List[List[int]] = [
    [p["dignity"].get(s, 0) for s in SIGNS] for p in SPEC["natal"]["planets"]
]
ASC_ALCHEMY: List[float] = SPEC["natal"]["ascendantAlchemy"]
EPS: float = float(C["epsilon"])

MATTER = 2
SUBSTANCE = 3

PLANETS: Tuple[str, ...] = (
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
)

DEFAULT_AGENT_POOLS: List[float] = [80.0, 80.0, 80.0, 80.0]

AGENT_ARCHETYPE_CHARTS: Dict[str, Dict[str, Any]] = {
    "Sun": {
        "signs": [4, 0, 4, 6, 8, 4, 10, 0, 8, 4],
        "ascendantSign": 4,
        "timeKnown": True,
    },
    "Moon": {
        "signs": [3, 1, 3, 11, 7, 3, 11, 3, 11, 7],
        "ascendantSign": 3,
        "timeKnown": True,
    },
    "Mercury": {
        "signs": [2, 10, 5, 2, 2, 2, 6, 10, 2, 5],
        "ascendantSign": 2,
        "timeKnown": True,
    },
    "Venus": {
        "signs": [1, 11, 1, 6, 1, 11, 6, 1, 11, 6],
        "ascendantSign": 1,
        "timeKnown": True,
    },
    "Mars": {
        "signs": [0, 7, 0, 0, 9, 0, 0, 0, 7, 7],
        "ascendantSign": 0,
        "timeKnown": True,
    },
    "Jupiter": {
        "signs": [8, 8, 8, 11, 4, 3, 8, 0, 11, 4],
        "ascendantSign": 8,
        "timeKnown": True,
    },
    "Saturn": {
        "signs": [9, 9, 10, 9, 9, 9, 6, 10, 9, 9],
        "ascendantSign": 9,
        "timeKnown": True,
    },
    "Uranus": {
        "signs": [10, 2, 10, 10, 10, 6, 10, 10, 10, 7],
        "ascendantSign": 10,
        "timeKnown": True,
    },
    "Neptune": {
        "signs": [11, 3, 11, 11, 11, 11, 3, 11, 11, 7],
        "ascendantSign": 11,
        "timeKnown": True,
    },
    "Pluto": {
        "signs": [7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        "ascendantSign": 7,
        "timeKnown": True,
    },
}

PILLAR_VOICE_LINES = {
    "Sun": lambda op, my: f"The golden light purges all impurity. Your {op} dissolves beneath the radiant clarity of {my}.",
    "Moon": lambda op, my: f"As the tides answer the night, your {op} yields to the mysterious depth of {my}.",
    "Mercury": lambda op, my: f"Swift transmutation! Before your {op} takes hold, my {my} inverts the reaction entirely.",
    "Venus": lambda op, my: f"True elegance seeks divine proportion. I harmonize your turbulent {op} through the grace of {my}.",
    "Mars": lambda op, my: f"Iron sharpens iron! I shatter the foundation of your {op} with an uncompromising strike of {my}!",
    "Jupiter": lambda op, my: f"By sovereign decree of the celestial spheres, your {op} is magnified and surpassed by {my}.",
    "Saturn": lambda op, my: f"Time and crystallization conquer all frenzy. Let your {op} solidify and yield to {my}.",
    "Uranus": lambda op, my: f"The unexpected fulmination! A flash of insight disrupts your {op} as {my} rewires the circuit.",
    "Neptune": lambda op, my: f"Dissolve the veil of form. Your {op} drifts away like sea foam in the boundless ocean of {my}.",
    "Pluto": lambda op, my: f"Through the crucible of rebirth. What was stripped by your {op} rises renewed through {my}.",
}


def now_iso_z() -> str:
    """ISO 8601 UTC timestamp with trailing Z matching JS Date.prototype.toISOString."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def is_planetary_agent(v: Any) -> bool:
    return isinstance(v, str) and v in PLANETS


def pillar_by_id(id_num: int) -> Optional[Dict[str, Any]]:
    return BY_ID.get(id_num)


def pillar_by_name(name_or_key: str) -> Optional[Dict[str, Any]]:
    normalized = str(name_or_key).strip().lower()
    return BY_NAME.get(normalized) or BY_KEY.get(normalized)


# ---------------------------------------------------------------------------
# Core Circuit Calculations
# ---------------------------------------------------------------------------

def counted_signs(chart: Dict[str, Any]) -> List[int]:
    signs = list(chart["signs"])
    if chart.get("timeKnown", True) and "ascendantSign" in chart:
        signs.append(chart["ascendantSign"])
    return signs


def element_counts(chart: Dict[str, Any]) -> Dict[str, int]:
    counts = {e: 0 for e in ELEMENTS}
    for s in counted_signs(chart):
        counts[ELEMENTS[s % 4]] += 1
    return counts


def modality_counts(chart: Dict[str, Any]) -> Dict[str, int]:
    counts = {m: 0 for m in MODALITIES}
    for s in counted_signs(chart):
        counts[MODALITIES[s % 3]] += 1
    return counts


def dignity(planet: int, sign: int) -> int:
    return DIGNITY[planet][sign % 12]


def natal_esms(chart: Dict[str, Any]) -> List[float]:
    esms = [0.0, 0.0, 0.0, 0.0]
    for planet, sign in enumerate(chart["signs"]):
        mult = 1.0 + 0.1 * abs(DIGNITY[planet][sign])
        for k in range(4):
            esms[k] += ALCHEMY[planet][k] * mult
    if chart.get("timeKnown", True) and "ascendantSign" in chart:
        for k in range(4):
            esms[k] += ASC_ALCHEMY[k] * 1.0
    return esms


def thermo(esms: List[float], counts: Dict[str, int]) -> Tuple[float, float, float, float]:
    s, e, m, b = esms
    fire, earth, air, water = (float(counts[x]) for x in ELEMENTS)
    heat_den = b + e + m + water + air + earth
    heat = (s * s + fire * fire) / max(heat_den * heat_den, EPS)
    ent_den = e + m + earth + water
    entropy = (s * s + b * b + fire * fire + air * air) / max(ent_den * ent_den, EPS)
    rea_den = m + earth
    reactivity = (s * s + b * b + e * e + fire * fire + air * air + water * water) / max(rea_den * rea_den, EPS)
    energy = heat - entropy * reactivity
    return heat, entropy, reactivity, energy


def clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def circuit_state(chart: Dict[str, Any], pools: List[float], q: Optional[float] = None) -> Dict[str, Any]:
    q_val = float(C["castCharge"] if q is None else q)
    base = float(C["poolBaseline"])
    counts = element_counts(chart)
    natal = natal_esms(chart)
    live = [natal[k] * pools[k] / base for k in range(4)]
    heat, entropy, reactivity, energy = thermo(live, counts)
    charge = live[MATTER] + live[SUBSTANCE]
    drain = pools[MATTER] + pools[SUBSTANCE]
    if drain > 0:
        q_matter = q_val * pools[MATTER] / drain
        q_substance = q_val * pools[SUBSTANCE] / drain
    else:
        q_matter = q_substance = 0.0
    charge_spent = natal[MATTER] * q_matter / base + natal[SUBSTANCE] * q_substance / base
    current = reactivity * charge_spent
    voltage = energy / charge if charge > EPS else 0.0
    power = current * voltage
    potency = reactivity * abs(energy)
    return {
        "elementCounts": counts,
        "modalityCounts": modality_counts(chart),
        "bodies": len(counted_signs(chart)),
        "natalEsms": natal,
        "liveEsms": live,
        "heat": heat,
        "entropy": entropy,
        "reactivity": reactivity,
        "energy": energy,
        "charge": charge,
        "chargeSpent": charge_spent,
        "current": current,
        "voltage": voltage,
        "power": power,
        "potency": potency,
        "magnitude": clamp(abs(power) / C["powerRef"], C["magnitudeMin"], C["magnitudeMax"]),
        "canCast": drain >= q_val,
    }


def potency(chart: Dict[str, Any], pools: List[float]) -> float:
    return circuit_state(chart, pools)["potency"]


def pay(pools: List[float], q: float) -> List[float]:
    drain = pools[MATTER] + pools[SUBSTANCE]
    out = list(pools)
    if drain > 0:
        out[MATTER] = pools[MATTER] - q * pools[MATTER] / drain
        out[SUBSTANCE] = pools[SUBSTANCE] - q * pools[SUBSTANCE] / drain
    return out


def cast_delta(pillar: Dict[str, Any], magnitude: float, q: float) -> List[float]:
    raw = [pillar["effects"][k] * pillar["k"] * magnitude * C["deltaScale"] for k in range(4)]
    total = sum(abs(v) for v in raw)
    if total > q:
        scale = q / total
        raw = [v * scale for v in raw]
    return raw


def apply_delta(pools: List[float], delta: List[float]) -> List[float]:
    return [max(0.0, pools[k] + delta[k]) for k in range(4)]


# ---------------------------------------------------------------------------
# Hand Determination
# ---------------------------------------------------------------------------

def hand(chart: Dict[str, Any], sky: str) -> List[int]:
    counts = element_counts(chart)
    luminary = DIGNITY[0][chart["signs"][0]] > 0 or DIGNITY[1][chart["signs"][1]] > 0

    def eligible(p: Dict[str, Any]) -> bool:
        in_sect = p["sect"] == sky or p["sect"] == "both"
        return in_sect and (not p.get("requiresLuminaryDignity") or luminary)

    ids = [
        p["id"]
        for p in PILLARS
        if eligible(p) and counts[p["primary"]] >= C["minPrimaryPlacements"]
    ]
    if len(ids) < C["minHand"]:
        rest = sorted(
            (p for p in PILLARS if eligible(p) and p["id"] not in ids),
            key=lambda p: (-counts[p["primary"]], p["id"]),
        )
        for p in rest:
            if len(ids) >= C["minHand"]:
                break
            ids.append(p["id"])
    return sorted(ids)


def get_agent_legal_hand(planet: str, sky: str = "diurnal") -> List[Dict[str, Any]]:
    chart = AGENT_ARCHETYPE_CHARTS.get(planet)
    if not chart:
        return []
    ids = hand(chart, sky)
    return [BY_ID[i] for i in ids if i in BY_ID]


# ---------------------------------------------------------------------------
# Duel Resolution & Best Response
# ---------------------------------------------------------------------------

def resolve_duel(
    a_chart: Dict[str, Any],
    a_pools: List[float],
    a_pillar_id: int,
    b_chart: Dict[str, Any],
    b_pools: List[float],
    b_pillar_id: int,
    q: Optional[float] = None,
) -> Dict[str, Any]:
    q_val = float(C["castCharge"] if q is None else q)
    sa = circuit_state(a_chart, a_pools, q_val)
    sb = circuit_state(b_chart, b_pools, q_val)
    if not (sa["canCast"] and sb["canCast"]):
        raise ValueError("Both casters need MATTER + SUBSTANCE of at least the cast charge")

    pa = BY_ID[a_pillar_id]
    pb = BY_ID[b_pillar_id]
    a_after = pay(a_pools, q_val)
    b_after = pay(b_pools, q_val)
    delta_a = cast_delta(pa, sa["magnitude"], q_val)
    delta_b = cast_delta(pb, sb["magnitude"], q_val)

    if pa["castMode"] == "self":
        a_after = apply_delta(a_after, delta_a)
    else:
        b_after = apply_delta(b_after, delta_a)

    if pb["castMode"] == "self":
        b_after = apply_delta(b_after, delta_b)
    else:
        a_after = apply_delta(a_after, delta_b)

    ratio_a = potency(a_chart, a_after) / max(sa["potency"], EPS)
    ratio_b = potency(b_chart, b_after) / max(sb["potency"], EPS)
    diff = ratio_a - ratio_b
    winner = "a" if diff > C["tieTolerance"] else "b" if diff < -C["tieTolerance"] else "draw"

    return {
        "magnitudeA": sa["magnitude"],
        "magnitudeB": sb["magnitude"],
        "deltaA": delta_a,
        "deltaB": delta_b,
        "poolsA": a_after,
        "poolsB": b_after,
        "ratioA": ratio_a,
        "ratioB": ratio_b,
        "winner": winner,
    }


def select_best_pillar_response(
    my_chart: Dict[str, Any],
    my_pools: List[float],
    opponent_chart: Dict[str, Any],
    opponent_pools: List[float],
    opponent_pillar_id: int,
    sky: str = "diurnal",
) -> Optional[Dict[str, Any]]:
    legal_ids = hand(my_chart, sky)
    if not legal_ids:
        return None

    best_choice = None
    best_ratio_diff = -float("inf")

    for pid in legal_ids:
        try:
            pillar = BY_ID[pid]
            outcome = resolve_duel(
                opponent_chart,
                opponent_pools,
                opponent_pillar_id,
                my_chart,
                my_pools,
                pid,
            )
            ratio_diff = outcome["ratioB"] - outcome["ratioA"]
            win = outcome["winner"] == "b"
            if ratio_diff > best_ratio_diff:
                best_ratio_diff = ratio_diff
                best_choice = {"bestPillar": pillar, "outcome": outcome, "win": win}
        except Exception:
            continue

    return best_choice


def answer_pillar_duel(
    agent_planet: str,
    opening_pillar_id: int,
    challenger_chart: Optional[Dict[str, Any]] = None,
    challenger_pools: Optional[List[float]] = None,
    sky: str = "diurnal",
    agent_pools: Optional[List[float]] = None,
) -> Dict[str, Any]:
    agent_chart = AGENT_ARCHETYPE_CHARTS[agent_planet]
    c_chart = challenger_chart or agent_chart
    c_pools = challenger_pools if (challenger_pools and len(challenger_pools) == 4) else DEFAULT_AGENT_POOLS
    a_pools = agent_pools if (agent_pools and len(agent_pools) == 4) else DEFAULT_AGENT_POOLS

    best = select_best_pillar_response(
        agent_chart,
        a_pools,
        c_chart,
        c_pools,
        opening_pillar_id,
        sky,
    )

    legal_hand = get_agent_legal_hand(agent_planet, sky)
    chosen_pillar = best["bestPillar"] if best else (legal_hand[0] if legal_hand else BY_ID[1])
    opening_pillar = BY_ID.get(opening_pillar_id)
    opening_name = opening_pillar["name"] if opening_pillar else "Pillar"

    outcome = best["outcome"] if best else resolve_duel(
        c_chart, c_pools, opening_pillar_id, agent_chart, a_pools, chosen_pillar["id"]
    )

    voice_fn = PILLAR_VOICE_LINES.get(
        agent_planet,
        lambda op, my: f"By the harmony of the spheres, your {op} is met by {my}.",
    )
    voice = voice_fn(opening_name, chosen_pillar["name"])
    will_win = outcome["winner"] == "b"

    return {
        "chosenPillar": chosen_pillar,
        "voice": voice,
        "outcome": outcome,
        "willWin": will_win,
    }


def open_pillar_duel(
    agent_planet: str,
    opponent_chart: Optional[Dict[str, Any]] = None,
    sky: str = "diurnal",
    agent_pools: Optional[List[float]] = None,
) -> Dict[str, Any]:
    agent_chart = AGENT_ARCHETYPE_CHARTS[agent_planet]
    a_pools = agent_pools if (agent_pools and len(agent_pools) == 4) else DEFAULT_AGENT_POOLS
    legal_hand = get_agent_legal_hand(agent_planet, sky)
    state = circuit_state(agent_chart, a_pools)

    ruling_pillars = [p for p in legal_hand if agent_planet in p.get("rulers", [])]
    opening_pillar = ruling_pillars[0] if ruling_pillars else (legal_hand[0] if legal_hand else BY_ID[1])

    voice = f"{agent_planet} invokes {opening_pillar['name']} under the {sky} sky."
    return {
        "openingPillar": opening_pillar,
        "voice": voice,
        "magnitude": state["magnitude"],
    }
