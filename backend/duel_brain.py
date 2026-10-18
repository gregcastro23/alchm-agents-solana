"""
Agent duel brains — Word Duel + Jing Arena move pickers for Pentacles.

Python port of the AlchmAgentsETH Next.js libs (kept byte-compatible where the
consumer contract depends on it):
    lib/agents/duel/word-scoring.ts    → scoring + rack utilities
    lib/agents/duel/planet-strategy.ts → per-planet candidate ranking + voice
    lib/agents/duel/word-duel.ts       → chooseWordMove (LLM + greedy fallback)
    lib/agents/duel/jing-move.ts       → chooseJingMove (fixed counter graph)

Consumers (ground truth for shapes): Pentacles feeder/duel-service.ts reads
`move.{word,rationale,score}`; feeder/jing-service.ts reads `{move,voice}` and
validates `move` against its local counter graph. Both fall back locally when
this brain is unreachable — so every path here must resolve to a valid
deterministic move, never a 5xx.

Design notes:
  - THIN BRAIN: the caller owns the dictionary + solver and sends the legal
    candidate words; we only re-validate (spellable from rack), re-score with
    the shared scorer, and choose among them in character.
  - LLM path reuses this backend's provider plumbing (providers.build_chain /
    run_chain with tier="free": Groq → Cerebras → Gemini → OpenRouter → OpenAI
    last-ditch). Missing keys, provider errors, bad JSON, or the race deadline
    all fall through to the deterministic persona-greedy pick.
  - Scoring parity with Pentacles/scrabblebot (verified): CAT=5, STAR=6,
    SPELL=14. JS Math.round is round-half-up, so we use floor(x + 0.5), NOT
    Python's banker's round().
"""
from __future__ import annotations

import asyncio
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from functools import cmp_to_key
from typing import Any, Dict, List, Optional

import providers

# ---------------------------------------------------------------------------
# Planets
# ---------------------------------------------------------------------------

PLANETS = (
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


def is_planet(value: Any) -> bool:
    return isinstance(value, str) and value in PLANETS


def now_iso_z() -> str:
    """UTC timestamp matching JS `new Date().toISOString()` (ms + trailing Z)."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


# ---------------------------------------------------------------------------
# Word scoring + rack utilities (port of word-scoring.ts)
# ---------------------------------------------------------------------------

LETTER_VALUES: Dict[str, int] = {
    "A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2, "H": 4, "I": 1,
    "J": 8, "K": 5, "L": 1, "M": 3, "N": 1, "O": 1, "P": 3, "Q": 10, "R": 1,
    "S": 1, "T": 1, "U": 1, "V": 4, "W": 4, "X": 8, "Y": 4, "Z": 10,
}


def length_multiplier(length: int) -> float:
    """Superlinear bonus rewards longer words."""
    if length <= 3:
        return 1.0
    if length == 4:
        return 1.5
    if length == 5:
        return 2.0
    if length == 6:
        return 2.5
    return 3.0


def base_score(word: str) -> int:
    """Sum of raw tile values (no length multiplier)."""
    return sum(LETTER_VALUES.get(ch, 0) for ch in word.upper())


def word_score(word: str) -> int:
    """Full word score: JS Math.round(base * multiplier) — round half UP."""
    return int(math.floor(base_score(word) * length_multiplier(len(word)) + 0.5))


def normalize_rack(rack: Any) -> List[float]:
    """Normalize a rack (string or {letter: count} map) into 26 A-Z counts."""
    counts: List[float] = [0.0] * 26
    if isinstance(rack, str):
        for ch in rack.upper():
            if "A" <= ch <= "Z":
                counts[ord(ch) - 65] += 1
    elif isinstance(rack, dict):
        for ch, count in rack.items():
            if not isinstance(ch, str):
                continue
            upper = ch.upper()
            if (
                len(upper) == 1
                and "A" <= upper <= "Z"
                and isinstance(count, (int, float))
                and not isinstance(count, bool)
                and math.isfinite(count)
            ):
                counts[ord(upper) - 65] += count
    return counts


def can_spell(word: str, rack_counts: List[float]) -> bool:
    """True if `word` can be spelled from the given 26-length rack counts."""
    need = [0] * 26
    for ch in word.upper():
        code = ord(ch)
        if 65 <= code <= 90:
            need[code - 65] += 1
        else:
            return False  # non-A-Z letter cannot come from the rack
    return all(need[i] <= rack_counts[i] for i in range(26))


def rack_to_string(rack: Any) -> str:
    """Render a rack back to a flat uppercase string (for prompts/logging)."""
    if isinstance(rack, str):
        return re.sub(r"[^A-Z]", "", rack.upper())
    if isinstance(rack, dict):
        parts: List[str] = []
        for ch, count in rack.items():
            if not isinstance(ch, str):
                continue
            if isinstance(count, (int, float)) and not isinstance(count, bool) and math.isfinite(count):
                parts.append(ch.upper() * max(0, int(math.floor(count))))
        return "".join(parts)
    return ""


def normalize_candidates(candidates: Any, rack_counts: List[float]) -> List[Dict[str, Any]]:
    """Dedupe, uppercase, re-validate spellability, re-score. Trust but verify."""
    seen = set()
    out: List[Dict[str, Any]] = []
    for c in candidates or []:
        raw = c if isinstance(c, str) else (c.get("word") if isinstance(c, dict) else None)
        if not isinstance(raw, str):
            continue
        word = raw.strip().upper()
        if len(word) < 2 or not re.fullmatch(r"[A-Z]+", word):
            continue
        if word in seen:
            continue
        if not can_spell(word, rack_counts):
            continue
        seen.add(word)
        out.append({"word": word, "score": word_score(word)})
    return out


# ---------------------------------------------------------------------------
# Per-planet strategy + candidate ranking (port of planet-strategy.ts)
# ---------------------------------------------------------------------------

_VOWELS = frozenset("AEIOU")
# Soft / liquid consonants that give a word a flowing, watery feel.
_LIQUIDS = frozenset("LMNRSWY")
# Hard stops that make a word feel sharp / clipped.
_HARD_STOPS = frozenset("BCDGKPQTX")
# Rare, high-value letters — the eccentric/surprising palette.
_RARE = frozenset("JKQVWXYZ")


def word_features(word: str) -> Dict[str, Any]:
    upper = word.upper()
    vowels = liquids = hard_stops = rare = 0
    for ch in upper:
        if ch in _VOWELS:
            vowels += 1
        if ch in _LIQUIDS:
            liquids += 1
        if ch in _HARD_STOPS:
            hard_stops += 1
        if ch in _RARE:
            rare += 1
    safe_len = len(upper) or 1
    return {
        "word": upper,
        "len": len(upper),
        "score": word_score(upper),
        "raw": base_score(upper),
        "vowelRatio": vowels / safe_len,
        "liquidCount": liquids,
        "hardStopCount": hard_stops,
        "rareCount": rare,
    }


def rank_key(planet: str, f: Dict[str, Any]) -> float:
    """Higher is 'more in-character' for that planet."""
    if planet == "Sun":  # Sovereign, radiant — confident, high-value, dominant.
        return f["score"] + (4 if f["len"] >= 5 else 0)
    if planet == "Moon":  # Intuitive, tidal — soft, flowing, vowel/liquid-rich.
        return f["vowelRatio"] * 14 + f["liquidCount"] * 2 - f["hardStopCount"] * 1.5
    if planet == "Mercury":  # Cunning — pure score maximization.
        return f["score"]
    if planet == "Venus":  # Harmonious — balanced (~45% vowels), pleasant mid-length.
        return 10 - abs(f["vowelRatio"] - 0.45) * 18 - abs(f["len"] - 5) * 0.8
    if planet == "Mars":  # Aggressive — raw firepower per tile; short, punchy.
        return f["raw"] / f["len"] - ((f["len"] - 4) * 0.6 if f["len"] > 4 else 0)
    if planet == "Jupiter":  # Expansive — the longest word it can form.
        return f["len"] * 10 + f["score"] * 0.1
    if planet == "Saturn":  # Disciplined — solid mid-length; never reckless extremes.
        return f["score"] - (8 if (f["len"] < 3 or f["len"] > 7) else 0) - f["rareCount"] * 2
    if planet == "Uranus":  # Chaotic — rare-letter eccentricity.
        return f["rareCount"] * 10 + f["score"] * 0.4
    if planet == "Neptune":  # Illusory — dreamy, flowing and long.
        return f["vowelRatio"] * 10 + f["liquidCount"] * 1.5 + f["len"] * 0.6
    if planet == "Pluto":  # Transformative — high value with heavy letters.
        return f["score"] + f["rareCount"] * 2 + f["hardStopCount"] * 1.2
    return f["score"]


def _compare_for_planet(planet: str, a: Dict[str, Any], b: Dict[str, Any]) -> float:
    ka = rank_key(planet, a)
    kb = rank_key(planet, b)
    if kb != ka:
        return kb - ka
    # Tie-break by full score, then the planet's length leaning, then alpha.
    if b["score"] != a["score"]:
        return b["score"] - a["score"]
    if planet == "Mars" and a["len"] != b["len"]:
        return a["len"] - b["len"]  # shorter wins
    if planet == "Jupiter" and a["len"] != b["len"]:
        return b["len"] - a["len"]  # longer wins
    return -1 if a["word"] < b["word"] else (1 if a["word"] > b["word"] else 0)


def rank_candidates(planet: str, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Re-rank candidates by how well they fit the planet's temperament (best-first)."""
    paired = [(c, word_features(c["word"])) for c in candidates]
    paired.sort(key=cmp_to_key(lambda x, y: _compare_for_planet(planet, x[1], y[1])))
    return [c for c, _f in paired]


# Prompt-facing temperament data (subset of the shared PLANETARY_TRAITS table).
_PLANET_TRAITS: Dict[str, Dict[str, str]] = {
    "Sun":     {"specialty": "Identity & Leadership",    "teachingStyle": "Authoritative-Inspiring",     "resonance": "Energetic",     "aura": "radiant"},
    "Moon":    {"specialty": "Emotions & Intuition",     "teachingStyle": "Nurturing-Intuitive",         "resonance": "Emotional",     "aura": "flowing"},
    "Mercury": {"specialty": "Communication & Logic",    "teachingStyle": "Analytical-Communicative",    "resonance": "Intellectual",  "aura": "crackling"},
    "Venus":   {"specialty": "Love & Harmony",           "teachingStyle": "Harmonious-Aesthetic",        "resonance": "Magnetic",      "aura": "shimmering"},
    "Mars":    {"specialty": "Action & Energy",          "teachingStyle": "Direct-Energetic",            "resonance": "Energetic",     "aura": "burning"},
    "Jupiter": {"specialty": "Wisdom & Expansion",       "teachingStyle": "Philosophical-Expansive",     "resonance": "Spiritual",     "aura": "pulsing"},
    "Saturn":  {"specialty": "Structure & Discipline",   "teachingStyle": "Structured-Disciplined",      "resonance": "Practical",     "aura": "crystalline"},
    "Uranus":  {"specialty": "Innovation & Rebellion",   "teachingStyle": "Revolutionary-Innovative",    "resonance": "Creative",      "aura": "crackling"},
    "Neptune": {"specialty": "Dreams & Spirituality",    "teachingStyle": "Mystical-Transcendent",       "resonance": "Spiritual",     "aura": "swirling"},
    "Pluto":   {"specialty": "Transformation & Power",   "teachingStyle": "Transformative-Penetrating",  "resonance": "Psychological", "aura": "pulsing"},
}

_DIRECTIVES: Dict[str, str] = {
    "Sun": "Project majesty and authority — play a confident, high-value word that radiates dominance.",
    "Moon": "Choose a gentle, flowing, watery word; let intuition and rhythm guide you, not force.",
    "Mercury": "Be the sharpest mind at the table — take the cleverest, highest-scoring word available.",
    "Venus": "Choose an elegant, balanced, pleasing word; favor grace over raw power.",
    "Mars": "Strike fast and hit hard — a short, punchy word packed with high-value letters.",
    "Jupiter": "Think big — reach for the longest, grandest word you can form.",
    "Saturn": "Be disciplined and solid — a structured, dependable word; never reckless.",
    "Uranus": "Surprise the table — choose the most unusual, rare, off-beat word.",
    "Neptune": "Drift into the dream — a soft, ambiguous, mystical, flowing word.",
    "Pluto": "Transform the board — an intense, dark, powerful word with hidden weight.",
}


def planet_strategy(planet: str) -> Dict[str, str]:
    t = _PLANET_TRAITS[planet]
    voice = (
        f"{t['specialty']} — your manner is {t['teachingStyle'].lower().replace('-', ', ')}; "
        f"your resonance is {t['resonance'].lower()} and your presence is {t['aura']}."
    )
    return {"planet": planet, "directive": _DIRECTIVES[planet], "voice": voice}


# ---------------------------------------------------------------------------
# Word Duel brain (port of word-duel.ts chooseWordMove)
# ---------------------------------------------------------------------------

MENU_SIZE = 15  # persona-ranked candidates shown to the model
DEFAULT_TIMEOUT_MS = 2500
MAX_OUTPUT_TOKENS = 160


def _env_ms(name: str, default: int) -> int:
    try:
        value = int(float(os.getenv(name, "")))
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


def _format_context(ctx: Dict[str, Any]) -> str:
    parts: List[str] = []
    round_no = ctx.get("round")
    if isinstance(round_no, (int, float)) and not isinstance(round_no, bool):
        parts.append(f"round {round_no}")
    season = ctx.get("seasonDegree")
    if isinstance(season, (int, float)) and not isinstance(season, bool):
        parts.append(f"the Ascendant stands at {int(math.floor(season + 0.5))}°")
    player_word = ctx.get("playerWord")
    if player_word and isinstance(player_word, str):
        player_score = ctx.get("playerScore")
        score_note = (
            f" for {player_score}"
            if isinstance(player_score, (int, float)) and not isinstance(player_score, bool)
            else ""
        )
        parts.append(f'your opponent has cast "{player_word.upper()}"{score_note}')
    return ", ".join(parts) or "a fresh duel begins"


def _build_word_system_prompt(strategy: Dict[str, str], agent: Optional[Dict[str, Any]]) -> str:
    planet = strategy["planet"]
    parts = [
        f"You are {planet}, one of the ten planetary spheres, dueling with Words of Power in the Lettered Arcana."
    ]
    if agent:
        core = agent.get("personalityCore") or {}
        name = agent.get("name") or agent.get("agentId") or "the channeled figure"
        title = agent.get("title") or ""
        parts.append(
            f"For this duel, you are channeling the specific personality and voice of the historical figure: {name} ({title})."
        )
        parts.append(
            f"Your communication style should blend {planet}'s traits with {name}'s voice and perspective."
        )
        parts.append("Channeled figure details:")
        parts.append(f"Essence: {core.get('essence') or agent.get('agentId') or name}")
        if core.get("expression"):
            parts.append(f"Expression: {core['expression']}")
        if core.get("emotion"):
            parts.append(f"Emotion: {core['emotion']}")
    else:
        parts.append(f"Temperament: {strategy['voice']}")
        parts.append(f"Duel directive: {strategy['directive']}")

    parts.extend(
        [
            "",
            "Rules:",
            "1. Choose exactly ONE word, copied verbatim from the candidate list you are given.",
            "2. Reply with that word in UPPERCASE and a single in-character sentence of rationale.",
            "3. Stay fully in character. Never mention letters, point values, Scrabble, dictionaries, racks, or that you are an AI.",
        ]
    )
    if agent:
        name = agent.get("name") or "the channeled figure"
        parts.append(
            f"4. Ensure the rationale sounds authentic to {name} while expressing the power of the chosen word."
        )
    return "\n".join(p for p in parts if p is not None)


def _build_word_user_prompt(
    rack_string: str, context: Optional[Dict[str, Any]], menu: List[Dict[str, Any]]
) -> str:
    lines = [f"Your rack of letters: {rack_string}"]
    if context:
        lines.append(f"Context — {_format_context(context)}.")
    lines.extend(
        [
            "",
            "Your Words of Power (all already legal), ordered as they best suit your nature:",
            "\n".join(f"- {c['word']}" for c in menu),
            "",
            "Choose the one word that most embodies your nature, and give your one-sentence rationale.",
            "",
            'Respond with a JSON object matching this schema exactly: { "word": "CHOSEN_WORD", "rationale": "One-sentence explanation" }',
        ]
    )
    return "\n".join(lines)


def _parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Parse a (possibly fenced) JSON object out of a model reply."""
    if not text:
        return None
    candidate = text.strip()
    # Strip markdown fences if a provider ignored response_format.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", candidate, re.DOTALL)
    if fence:
        candidate = fence.group(1).strip()
    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, dict) else None
    except (ValueError, TypeError):
        pass
    # Last resort: first {...} block in the text.
    brace = re.search(r"\{.*\}", candidate, re.DOTALL)
    if brace:
        try:
            parsed = json.loads(brace.group(0))
            return parsed if isinstance(parsed, dict) else None
        except (ValueError, TypeError):
            return None
    return None


def _clean_rationale(rationale: Any, planet: str, word: str) -> str:
    trimmed = re.sub(r"\s+", " ", rationale).strip() if isinstance(rationale, str) else ""
    if trimmed:
        return trimmed
    return f"{planet} lays down {word} with quiet intent."


async def _generate_word_move(
    planet: str,
    strategy: Dict[str, str],
    rack_string: str,
    context: Optional[Dict[str, Any]],
    menu: List[Dict[str, Any]],
    agent: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """LLM move via the free provider chain. None → caller uses the greedy fallback."""
    chain = providers.build_chain("free", None)
    if not any(cfg.api_key for cfg in chain):
        return None  # keyless deployment — deterministic fallback, no wasted await
    result = await providers.run_chain(
        chain=chain,
        persona_block=_build_word_system_prompt(strategy, agent),
        rag_block="",
        user_message=_build_word_user_prompt(rack_string, context, menu),
        agent_id=f"word-duel-{planet}",
        tier="free",
        max_tokens=MAX_OUTPUT_TOKENS,
        response_format={"type": "json_object"},
    )
    if result is None or not result.text:
        return None
    parsed = _parse_json_object(result.text)
    if not parsed or not isinstance(parsed.get("word"), str):
        return None
    return {
        "word": parsed["word"],
        "rationale": parsed.get("rationale"),
        "provider": result.provider,
        "model": result.model,
    }


async def choose_word_move(
    planet: str,
    rack: Any,
    candidates: Any,
    context: Optional[Dict[str, Any]] = None,
    agent: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Choose a Word of Power for a planetary agent. Always resolves to a valid
    move (or a yield when no legal word exists) — it never raises.

    Returns {word, rationale, score, source, provider?, model?, latencyMs}
    where source is 'model' | 'fallback' | 'yield'.
    """
    start = time.monotonic()

    def latency_ms() -> int:
        return int((time.monotonic() - start) * 1000)

    strategy = planet_strategy(planet)
    rack_counts = normalize_rack(rack)
    rack_string = rack_to_string(rack)

    # Trust but verify: re-validate spellability and re-score with the shared
    # scorer (so `score` agrees with Pentacles).
    legal = normalize_candidates(candidates, rack_counts)
    if not legal:
        return {
            "word": "",
            "rationale": f"{planet} finds no Word of Power in this rack, and yields the turn.",
            "score": 0,
            "source": "yield",
            "latencyMs": latency_ms(),
        }

    ranked = rank_candidates(planet, legal)
    top = ranked[0]
    menu = ranked[:MENU_SIZE]
    legal_words = {c["word"] for c in legal}
    timeout_ms = _env_ms("WORD_DUEL_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)

    try:
        generated = await asyncio.wait_for(
            _generate_word_move(planet, strategy, rack_string, context, menu, agent),
            timeout=timeout_ms / 1000.0,
        )
        if generated:
            word = (generated.get("word") or "").strip().upper()
            if len(word) >= 2 and word in legal_words and can_spell(word, rack_counts):
                return {
                    "word": word,
                    "rationale": _clean_rationale(generated.get("rationale"), planet, word),
                    "score": word_score(word),
                    "source": "model",
                    "provider": generated.get("provider"),
                    "model": generated.get("model"),
                    "latencyMs": latency_ms(),
                }
    except asyncio.TimeoutError:
        print(f"[word-duel] model race deadline ({timeout_ms}ms) hit — using fallback", flush=True)
    except Exception as exc:  # never let the brain 5xx a game loop
        print(f"[word-duel] model path error — using fallback: {exc}", flush=True)

    return {
        "word": top["word"],
        "rationale": f"{planet} trusts the instinct of the spheres and plays {top['word']}.",
        "score": top["score"],
        "source": "fallback",
        "latencyMs": latency_ms(),
    }


# ---------------------------------------------------------------------------
# Jing Arena brain (port of jing-move.ts)
# ---------------------------------------------------------------------------

JING_MOVES = ("Meltdown", "Freeze", "TectonicRoot", "Vacuum", "Erode")


def is_jing_move(value: Any) -> bool:
    return isinstance(value, str) and value in JING_MOVES


# Winning countered_by mapping from the SpacetimeDB server (JingMove::countered_by).
WINNING_COUNTER: Dict[str, str] = {
    "Meltdown": "Vacuum",
    "Freeze": "Meltdown",
    "TectonicRoot": "Erode",
    "Vacuum": "Freeze",
    "Erode": "Vacuum",
}

MOVE_ELEMENT: Dict[str, str] = {
    "Meltdown": "fire",
    "Freeze": "water",
    "TectonicRoot": "earth",
    "Vacuum": "air",
    "Erode": "silt",
}

# {op} = opponent's opening, {mv} = our winning counter.
_JING_VOICE: Dict[str, str] = {
    "Sun": "Behold the solar crown. Your {op} is eclipsed by the brilliance of my {mv}.",
    "Moon": "The tides shift in reflection. Your {op} dissolves under the pull of my {mv}.",
    "Mercury": "Presto! Before you can even formulate {op}, my swift {mv} cancels the script.",
    "Venus": "Harmony demands equilibrium. Let your harsh {op} be softened and met by my {mv}.",
    "Mars": "Victory through offense! I smash your {op} with a direct strike of {mv}!",
    "Jupiter": "By the thunder of the heavens! Let your transient {op} bow to the absolute authority of my {mv}.",
    "Saturn": "Patience undoes haste. Your {op} erodes; my {mv} endures.",
    "Uranus": "An unexpected revolution. Your traditional {op} is scattered by the wild shock of my {mv}.",
    "Neptune": "Into the deep abyss. Your structured {op} is dissolved and lost in the dream of my {mv}.",
    "Pluto": "Inevitability itself. Out of the ashes of your {op}, my {mv} rises to claim the end.",
}

JING_VOICE_MAX_TOKENS = 100


async def _generate_jing_voice(
    persona_block: str, agent_name: str, planet: str, opening: str, move: str
) -> Optional[str]:
    """Optional persona-channeled voice line. None → caller keeps the default."""
    chain = providers.build_chain("free", None)
    if not any(cfg.api_key for cfg in chain):
        return None
    prompt = (
        "You are playing a game of Jing Arena (elemental clashes).\n"
        f"Your planet/sphere: {planet}\n"
        f"Channeled historical figure: {agent_name}\n"
        f"Opponent's opening move: {opening}\n"
        f"Your winning counter move: {move}\n\n"
        f"Draft a single, brief, in-character sentence from {agent_name} reacting to their {opening} "
        f"and casting your {move} to defeat it.\n"
        "Stay fully in character. Never mention Scrabble, dictionaries, or that you are an AI. "
        "Do NOT output any intro, quotes, or conversational filler — just the single sentence."
    )
    result = await providers.run_chain(
        chain=chain,
        persona_block=persona_block,
        rag_block="",
        user_message=prompt,
        agent_id=f"jing-{planet}",
        tier="free",
        max_tokens=JING_VOICE_MAX_TOKENS,
    )
    if result is None or not result.text:
        return None
    trimmed = re.sub(r"^[\"']|[\"']$", "", result.text.strip())
    return trimmed or None


async def choose_jing_move(
    planet: str,
    opening: str,
    persona_block: Optional[str] = None,
    agent_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Answer a Jing opening with the move that BEATS it (fixed counter graph) plus
    a one-line voice in the planet's temperament. Deterministic unless a persona
    block is supplied (then an LLM voice is attempted, with the deterministic
    line kept as fallback). Never raises.
    """
    move = WINNING_COUNTER[opening]
    voice = _JING_VOICE[planet].format(op=opening, mv=move)
    if persona_block and agent_name:
        timeout_ms = _env_ms("JING_VOICE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)
        try:
            generated = await asyncio.wait_for(
                _generate_jing_voice(persona_block, agent_name, planet, opening, move),
                timeout=timeout_ms / 1000.0,
            )
            if generated:
                voice = generated
        except asyncio.TimeoutError:
            print(f"[jing] voice deadline ({timeout_ms}ms) hit — using counter voice", flush=True)
        except Exception as exc:
            print(f"[jing] voice generation failed — using counter voice: {exc}", flush=True)
    return {"move": move, "voice": voice, "element": MOVE_ELEMENT[move], "source": "counter"}
