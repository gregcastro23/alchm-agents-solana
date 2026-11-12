"""
Rectification Service & Bayesian Ascendant Scorer
=================================================

Provides high-accuracy birth time rectification and candidate Ascendant
probability distribution estimation using Swiss Ephemeris (pyswisseph).

Key Capabilities:
- Minute-by-minute ephemeris sweep across 24 hours (or search windows).
- Recomputation of exact Moon longitude at EVERY candidate minute.
- Modular likelihood scorer interface (Western techniques v1:
  angular transits, secondary progressions, annual profections, primary directions).
- Null-baseline random date calibration to prevent overfitting to noise.
- 12-sign posterior probabilities, 80% credible time window, and certainty metrics.
- Benchmark runner against the 20 held-out measured historical agents.
"""

from abc import ABC, abstractmethod
from datetime import datetime
import math
import random
from typing import Any, Dict, List, Optional, Tuple
import swisseph as swe

try:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel, Field
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    class HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str = ""):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)
    class APIRouter:
        def post(self, *args, **kwargs):
            return lambda fn: fn
        def get(self, *args, **kwargs):
            return lambda fn: fn
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
    def Field(default=None, **kwargs):
        return default

router = APIRouter()

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

SWE_FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

SLOW_PLANETS = [
    ("Jupiter", swe.JUPITER),
    ("Saturn", swe.SATURN),
    ("Uranus", swe.URANUS),
    ("Neptune", swe.NEPTUNE),
    ("Pluto", swe.PLUTO),
]

SIGN_RULERS = {
    "Aries": "Mars",
    "Taurus": "Venus",
    "Gemini": "Mercury",
    "Cancer": "Moon",
    "Leo": "Sun",
    "Virgo": "Mercury",
    "Libra": "Venus",
    "Scorpio": "Mars",
    "Sagittarius": "Jupiter",
    "Capricorn": "Saturn",
    "Aquarius": "Saturn",
    "Pisces": "Jupiter",
}

ALL_PLANETS = [
    ("Sun", swe.SUN),
    ("Moon", swe.MOON),
    ("Mercury", swe.MERCURY),
    ("Venus", swe.VENUS),
    ("Mars", swe.MARS),
    ("Jupiter", swe.JUPITER),
    ("Saturn", swe.SATURN),
    ("Uranus", swe.URANUS),
    ("Neptune", swe.NEPTUNE),
    ("Pluto", swe.PLUTO),
]

NATAL_STATIC_PLANETS = [
    ("Sun", swe.SUN),
    ("Mercury", swe.MERCURY),
    ("Venus", swe.VENUS),
    ("Mars", swe.MARS),
    ("Jupiter", swe.JUPITER),
    ("Saturn", swe.SATURN),
]

CUSP_WEIGHTS: Dict[str, Dict[str, float]] = {
    "career": {"MC": 1.32, "ASC": 0.95, "IC": 0.78, "DSC": 0.75},
    "marriage": {"DSC": 1.32, "ASC": 0.92, "MC": 0.80, "IC": 0.72},
    "relocation": {"IC": 1.32, "ASC": 0.90, "MC": 0.82, "DSC": 0.72},
    "illness": {"ASC": 1.32, "MC": 0.92, "IC": 0.80, "DSC": 0.75},
    "general": {"ASC": 1.00, "MC": 1.00, "DSC": 0.80, "IC": 0.80},
}

PRIMARY_ANGLE_ROLE: Dict[str, Optional[str]] = {
    "career": "MC",
    "marriage": "DSC",
    "relocation": "IC",
    "illness": "ASC",
    "general": None,
}

PROFECTION_HOUSE_OFFSETS: Dict[str, int] = {
    "career": 9,      # 10th house
    "marriage": 6,    # 7th house
    "relocation": 3,  # 4th house
    "illness": 0,     # 1st house (also checks 6th below)
    "general": 9,
}


# --- Helpers ---

def normalize_event_category(evidence_item: Dict[str, Any]) -> str:
    """Maps event category/aliases or description keywords into canonical cusp-routing domains."""
    raw = str(evidence_item.get("category") or "").strip().lower()
    if raw in ("career", "publication", "office", "award", "work", "profession", "honors"):
        return "career"
    if raw in ("marriage", "partnership", "relationship", "legal", "divorce", "conflict"):
        return "marriage"
    if raw in ("relocation", "move", "family", "household", "home", "parent_death", "exile"):
        return "relocation"
    if raw in ("illness", "crisis", "injury", "accident", "surgery", "health", "vitality", "death", "fire", "arrest"):
        return "illness"

    desc = str(evidence_item.get("description") or "").lower()
    if any(w in desc for w in ("marri", "wed", "divorce", "trial", "inquisition", "sentenc", "break with")):
        return "marriage"
    if any(w in desc for w in ("relocat", "moved to", "arrival", "exile", "emigrat", "household", "parent", "father died", "mother died")):
        return "relocation"
    if any(w in desc for w in ("surger", "cancer", "injur", "collision", "fractur", "gunshot", "ear sever", "near death", "heart attack", "arrest", "imprison", "fire", "death")):
        return "illness"
    if any(w in desc for w in ("nobel", "prize", "publicat", "published", "premiere", "professor", "appoint", "chancellor", "present", "founding", "inaugur", "broadcast", "manuscript", "unveil", "annus mirabilis", "observat")):
        return "career"
    return "general"


def parse_event_jd(evidence_item: Dict[str, Any]) -> Optional[float]:
    """Parses event_date / date into an exact Julian Day UT."""
    event_date_str = evidence_item.get("event_date") or evidence_item.get("date")
    if not event_date_str:
        return None
    s = str(event_date_str).strip()
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        ut_hour = dt.hour + dt.minute / 60.0 + dt.second / 3600.0
        if "T" not in s and " " not in s:
            ut_hour = 12.0
        return swe.julday(dt.year, dt.month, dt.day, ut_hour, swe.GREG_CAL)
    except Exception:
        # Handle bare YYYY-MM or YYYY-MM-DD fallback
        parts = s.split("-")
        try:
            year = int(parts[0])
            month = int(parts[1]) if len(parts) > 1 else 6
            day = int(parts[2][:2]) if len(parts) > 2 else 15
            return swe.julday(year, month, day, 12.0, swe.GREG_CAL)
        except Exception:
            return None


def exact_age_years(event_jd: float, birth_jd: float) -> float:
    return max(0.0, (event_jd - birth_jd) / 365.2422)


def _calc_lons(jd: float, bodies: List[Tuple[str, int]]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for name, pid in bodies:
        vals, _ = swe.calc_ut(jd, pid, SWE_FLAGS)
        out[name] = vals[0] % 360.0
    return out


def oriented_angles(c: "CandidateMinute") -> Tuple[Tuple[str, float], ...]:
    return (
        ("ASC", c.asc_lon),
        ("MC", c.mc_lon),
        ("DSC", (c.asc_lon + 180.0) % 360.0),
        ("IC", (c.mc_lon + 180.0) % 360.0),
    )


def gaussian_aspect_hit(lon_a: float, lon_b: float, target: float, cutoff: float, sigma: float) -> float:
    diff = angular_difference(lon_a, lon_b)
    dist = aspect_orb(diff, target)
    if dist > cutoff:
        return 0.0
    return math.exp(-(dist * dist) / (2.0 * sigma * sigma))

def deg_to_sign_deg(lon: float) -> Tuple[str, float]:
    lon = lon % 360.0
    idx = int(lon // 30)
    return SIGNS[idx], round(lon - idx * 30, 2)


def angular_difference(a: float, b: float) -> float:
    """Separation between two ecliptic longitudes in [0, 180]."""
    return abs((a - b + 180.0) % 360.0 - 180.0)


def aspect_orb(diff: float, target_aspect: float = 0.0) -> float:
    """Distance from exact aspect (e.g. 0 conjunction, 90 square, 120 trine, 180 opposition)."""
    return abs(diff - target_aspect)


class CandidateMinute:
    __slots__ = ("minute", "local_time", "jd", "asc_lon", "mc_lon", "asc_sign", "mc_sign", "moon_lon", "moon_sign")

    def __init__(
        self,
        minute: int,
        local_time: str,
        jd: float,
        asc_lon: float,
        mc_lon: float,
        asc_sign: str,
        mc_sign: str,
        moon_lon: float,
        moon_sign: str,
    ):
        self.minute = minute
        self.local_time = local_time
        self.jd = jd
        self.asc_lon = asc_lon
        self.mc_lon = mc_lon
        self.asc_sign = asc_sign
        self.mc_sign = mc_sign
        self.moon_lon = moon_lon
        self.moon_sign = moon_sign


# --- Modular Likelihood Scorer Interface ---

class LikelihoodScorer(ABC):
    """Abstract base class for all rectification evidence scorers."""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        """Returns array of log-likelihood additions log(P(E | candidate)) for each candidate minute."""
        pass


class RecordedTimeScorer(LikelihoodScorer):
    """Gaussian likelihood centered on reported clock time; sigma scaled by Rodden rating."""

    @property
    def name(self) -> str:
        return "recorded_time"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        reported_minute = evidence_item.get("reported_minute", 720) # 0..1439
        rating = str(evidence_item.get("rodden_rating", "B")).upper()

        sigmas = {
            "AA": 15.0,  # official birth certificate
            "A": 30.0,   # memory / reliable biographical citation
            "B": 60.0,   # biography / autobiography
            "C": 120.0,  # approximate / cautioned
        }
        sigma = sigmas.get(rating, 240.0)

        log_likes = []
        two_sigma_sq = 2.0 * sigma * sigma
        for c in candidates:
            # Shortest circular distance in minutes across midnight
            diff_min = abs(c.minute - reported_minute)
            if diff_min > 720:
                diff_min = 1440 - diff_min
            log_l = -(diff_min * diff_min) / two_sigma_sq
            log_likes.append(log_l)
        return log_likes


class TimeClueScorer(LikelihoodScorer):
    """Anchors window clues (e.g. 'dawn', 'sunset', 'midnight', '4 hours before day') using ephemeris sun events."""

    @property
    def name(self) -> str:
        return "time_clue"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        target_minute_start = evidence_item.get("start_minute", 0)
        target_minute_end = evidence_item.get("end_minute", 1439)
        soft_margin = evidence_item.get("margin_minutes", 45)

        log_likes = []
        two_margin_sq = 2.0 * (soft_margin ** 2)
        for c in candidates:
            m = c.minute
            if target_minute_start <= m <= target_minute_end:
                log_likes.append(0.0)
            else:
                dist = min(abs(m - target_minute_start), abs(m - target_minute_end))
                log_likes.append(-(dist * dist) / two_margin_sq)
        return log_likes


class MoonSignScorer(LikelihoodScorer):
    """Hard or soft ingress boundary check for days where the Moon crosses signs."""

    @property
    def name(self) -> str:
        return "moon_sign"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        expected_sign = evidence_item.get("moon_sign")
        log_likes = []
        for c in candidates:
            if c.moon_sign == expected_sign:
                log_likes.append(0.0)
            else:
                log_likes.append(-4.6)  # ~1% relative probability for opposite side
        return log_likes


class AngularTransitScorer(LikelihoodScorer):
    """Slow planet transits to candidate Ascendant/Midheaven/IC/Descendant on major life event dates."""

    @property
    def name(self) -> str:
        return "angular_transits"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        event_date_str = evidence_item.get("event_date") or evidence_item.get("date") or evidence_item.get("date") # ISO string
        if not event_date_str:
            return [0.0] * len(candidates)

        try:
            dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
            event_jd = swe.julday(dt.year, dt.month, dt.day, 12.0, swe.GREG_CAL)
        except Exception:
            return [0.0] * len(candidates)

        # Compute transiting slow planet positions at noon UT of event date
        transiting_lons = []
        for _, pid in SLOW_PLANETS:
            vals, _ = swe.calc_ut(event_jd, pid, SWE_FLAGS)
            transiting_lons.append(vals[0] % 360.0)

        category = normalize_event_category(evidence_item)
        event_jd = parse_event_jd(evidence_item)
        if event_jd is None:
            return [0.0] * len(candidates)

        _ = transiting_lons  # superseded by domain-weighted planetary triggers
        trans_map = _calc_lons(event_jd, ALL_PLANETS)
        planet_weights: Dict[str, float] = {
            "Jupiter": 1.25 if category == "career" else 1.00,
            "Saturn": 1.20 if category in ("career", "illness", "relocation") else 1.00,
            "Uranus": 1.10,
            "Neptune": 1.10,
            "Pluto": 1.15,
            "Mars": 0.75 if category == "illness" else (0.40 if category == "marriage" else 0.25),
            "Venus": 0.70 if category == "marriage" else 0.15,
            "Sun": 0.35 if category in ("career", "illness") else 0.20,
        }
        cusp_w = CUSP_WEIGHTS[category]
        primary_role = PRIMARY_ANGLE_ROLE[category]
        conj_cutoff, conj_sigma = 2.6, 1.15

        log_likes = []
        for c in candidates:
            hit_score = 0.0
            angles = oriented_angles(c)
            for p_name, p_weight in planet_weights.items():
                t_lon = trans_map[p_name]
                # Take MAX single aspect contribution per planet so 0 deg MC and 90 deg ASC never double-count
                best_p_hit = 0.0
                for role, angle_lon in angles:
                    conj_hit = gaussian_aspect_hit(t_lon, angle_lon, 0.0, conj_cutoff, conj_sigma)
                    if conj_hit > 0.0:
                        best_p_hit = max(best_p_hit, cusp_w[role] * conj_hit)
                for base_role, base_lon in (("ASC", c.asc_lon), ("MC", c.mc_lon)):
                    sq_hit = gaussian_aspect_hit(t_lon, base_lon, 90.0, 2.2, 1.05)
                    if sq_hit > 0.0:
                        role_factor = 1.02 if base_role == primary_role else 0.85
                        best_p_hit = max(best_p_hit, 0.72 * role_factor * sq_hit)
                hit_score += p_weight * best_p_hit
            # Saturating compression per event prevents conjunct fast planets from drowning slow hits
            log_likes.append(min(2.2, 1.75 * math.log1p(hit_score)))
        return log_likes


class SecondaryProgressionScorer(LikelihoodScorer):
    """Secondary progressed Moon and Sun (1 day = 1 year of life) to natal angles on event dates."""

    @property
    def name(self) -> str:
        return "secondary_progressions"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        if not candidates:
            return []
        event_jd = parse_event_jd(evidence_item)
        if event_jd is None:
            return [0.0] * len(candidates)

        mid_jd = candidates[len(candidates) // 2].jd
        years_mid = exact_age_years(event_jd, mid_jd)
        if years_mid <= 0.0:
            return [0.0] * len(candidates)

        category = normalize_event_category(evidence_item)
        cusp_w = CUSP_WEIGHTS[category]
        primary_role = PRIMARY_ANGLE_ROLE[category]

        prog_static = _calc_lons(mid_jd + years_mid, [("Sun", swe.SUN), ("Venus", swe.VENUS), ("Mars", swe.MARS)])
        natal_static = _calc_lons(mid_jd, [("Sun", swe.SUN), ("Venus", swe.VENUS), ("Mars", swe.MARS), ("Saturn", swe.SATURN)])

        conj_cutoff, conj_sigma = 2.5, 1.15

        extra_prog: List[Tuple[str, float, float]] = [("Sun", prog_static["Sun"], 1.0)]
        if category == "marriage":
            extra_prog.append(("Venus", prog_static["Venus"], 0.85))
        elif category == "illness":
            extra_prog.append(("Mars", prog_static["Mars"], 0.85))

        log_likes = []
        for c in candidates:
            years_elapsed = exact_age_years(event_jd, c.jd)
            prog_jd = c.jd + years_elapsed
            # Progressed Moon recomputed at EVERY candidate minute
            p_moon_vals, _ = swe.calc_ut(prog_jd, swe.MOON, SWE_FLAGS)
            p_moon_lon = p_moon_vals[0] % 360.0

            hit = 0.0
            angles = oriented_angles(c)
            prog_bodies = [("Moon", p_moon_lon, 1.05)] + extra_prog
            for _, p_lon, p_w in prog_bodies:
                best_p = 0.0
                for role, angle_lon in angles:
                    c_hit = gaussian_aspect_hit(p_lon, angle_lon, 0.0, conj_cutoff, conj_sigma)
                    if c_hit > 0.0:
                        best_p = max(best_p, cusp_w[role] * c_hit)
                for base_role, base_lon in (("ASC", c.asc_lon), ("MC", c.mc_lon)):
                    s_hit = gaussian_aspect_hit(p_lon, base_lon, 90.0, 2.0, 0.95)
                    if s_hit > 0.0:
                        role_factor = 1.02 if base_role == primary_role else 0.85
                        best_p = max(best_p, 0.70 * role_factor * s_hit)
                hit += p_w * best_p

            best_moon_natal = 0.0
            for natal_key in ("Sun", "Venus", "Mars", "Saturn"):
                m_hit = gaussian_aspect_hit(p_moon_lon, natal_static[natal_key], 0.0, 1.8, 0.9)
                if m_hit > 0.0:
                    w_sig = 0.40 if (
                        (category == "marriage" and natal_key == "Venus")
                        or (category == "illness" and natal_key in ("Mars", "Saturn"))
                        or (category == "career" and natal_key == "Sun")
                    ) else 0.22
                    best_moon_natal = max(best_moon_natal, w_sig * m_hit)
            hit += best_moon_natal

            log_likes.append(min(2.0, 1.65 * math.log1p(hit)))
        return log_likes


class AnnualProfectionScorer(LikelihoodScorer):
    """Annual profection of Ascendant sign (1 sign per year of age) and lord-of-the-year angularity."""

    @property
    def name(self) -> str:
        return "annual_profections"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        if not candidates:
            return []
        event_jd = parse_event_jd(evidence_item)
        if event_jd is None:
            return [0.0] * len(candidates)

        exact_age = exact_age_years(event_jd, candidates[0].jd)
        prof_age = int(math.floor(exact_age))
        category = normalize_event_category(evidence_item)
        cat_house_offset = PROFECTION_HOUSE_OFFSETS.get(category, 9)

        mid_jd = candidates[len(candidates) // 2].jd
        natal_static = _calc_lons(mid_jd, NATAL_STATIC_PLANETS)
        trans_lons = _calc_lons(event_jd, ALL_PLANETS)

        heavy_trans = [
            ("Jupiter", 1.15 if category == "career" else 0.90),
            ("Saturn", 1.10 if category in ("illness", "relocation", "career") else 0.90),
            ("Mars", 1.10 if category == "illness" else 0.70),
            ("Uranus", 0.80),
            ("Neptune", 0.70),
            ("Pluto", 0.85),
            ("Sun", 0.70),
        ]

        def score_lord_lon(lord_name: str, lord_natal_lon: float, weight_scale: float) -> float:
            total = 0.0
            for t_name, t_w in heavy_trans:
                t_lon = trans_lons[t_name]
                h0 = gaussian_aspect_hit(t_lon, lord_natal_lon, 0.0, 3.0, 1.35)
                h180 = 0.65 * gaussian_aspect_hit(t_lon, lord_natal_lon, 180.0, 2.8, 1.25)
                h90 = 0.45 * gaussian_aspect_hit(t_lon, lord_natal_lon, 90.0, 2.4, 1.10)
                total += t_w * max(h0, h180, h90)
            t_lord = trans_lons[lord_name]
            total += 0.65 * max(
                gaussian_aspect_hit(t_lord, natal_static["Sun"], 0.0, 3.0, 1.30),
                0.70 * gaussian_aspect_hit(t_lord, natal_static["Sun"], 180.0, 2.5, 1.15),
            )
            return total * weight_scale

        sign_base_scores: List[float] = [0.0] * 12
        natal_signs = {name: int(lon // 30) % 12 for name, lon in natal_static.items()}
        trans_signs = {name: int(lon // 30) % 12 for name, lon in trans_lons.items()}

        for asc_idx in range(12):
            prof_1_idx = (asc_idx + prof_age) % 12
            prof_cat_idx = (asc_idx + cat_house_offset + prof_age) % 12
            lord_1 = SIGN_RULERS[SIGNS[prof_1_idx]]
            lord_cat = SIGN_RULERS[SIGNS[prof_cat_idx]]

            s = 0.0
            if lord_1 != "Moon":
                s += score_lord_lon(lord_1, natal_static[lord_1], 0.28)
            if lord_cat != lord_1 and lord_cat != "Moon":
                s += score_lord_lon(lord_cat, natal_static[lord_cat], 0.22)
            elif lord_cat == lord_1 and lord_1 != "Moon":
                s *= 1.12

            for p_name, p_sidx in natal_signs.items():
                if p_sidx == prof_1_idx:
                    s += 0.16 if p_name == "Sun" else 0.10
                if prof_cat_idx != prof_1_idx and p_sidx == prof_cat_idx:
                    domain_boost = 0.18 if (
                        (category == "career" and p_name in ("Sun", "Jupiter", "Saturn", "Mercury"))
                        or (category == "marriage" and p_name in ("Venus", "Jupiter", "Sun"))
                        or (category == "relocation" and p_name in ("Saturn", "Jupiter", "Sun"))
                        or (category == "illness" and p_name in ("Mars", "Saturn", "Sun"))
                    ) else 0.09
                    s += domain_boost

            for t_name, t_w in (("Jupiter", 0.16), ("Saturn", 0.15), ("Mars", 0.10), ("Uranus", 0.10), ("Pluto", 0.10)):
                t_sidx = trans_signs[t_name]
                if t_sidx == prof_1_idx:
                    s += t_w * 0.80
                if t_sidx == prof_cat_idx:
                    s += t_w

            sign_base_scores[asc_idx] = min(0.55, s)

        # Normalize sign-level profection scores relative to cross-sign mean to eliminate slow-sign bias
        sign_mean = sum(sign_base_scores) / 12.0
        sign_base_scores = [max(0.0, val - sign_mean) for val in sign_base_scores]

        primary_role = PRIMARY_ANGLE_ROLE[category] or "ASC"
        log_likes = []
        for c in candidates:
            asc_idx = int(c.asc_lon // 30) % 12
            prof_1_idx = (asc_idx + prof_age) % 12
            prof_cat_idx = (asc_idx + cat_house_offset + prof_age) % 12
            lord_1 = SIGN_RULERS[SIGNS[prof_1_idx]]
            lord_cat = SIGN_RULERS[SIGNS[prof_cat_idx]]

            bonus = sign_base_scores[asc_idx]
            if lord_1 == "Moon":
                bonus += min(0.35, score_lord_lon("Moon", c.moon_lon, 0.28))
            if lord_cat == "Moon" and lord_1 != "Moon":
                bonus += min(0.28, score_lord_lon("Moon", c.moon_lon, 0.22))

            moon_sidx = int(c.moon_lon // 30) % 12
            if moon_sidx == prof_1_idx:
                bonus += 0.12
            if prof_cat_idx != prof_1_idx and moon_sidx == prof_cat_idx:
                bonus += 0.14

            angle_map = dict(oriented_angles(c))
            t_lord = trans_lons[lord_1]
            bonus += 0.70 * gaussian_aspect_hit(t_lord, angle_map[primary_role], 0.0, 2.5, 1.15)
            bonus += 0.50 * gaussian_aspect_hit(t_lord, c.asc_lon, 90.0, 2.2, 1.05)
            if primary_role != "ASC":
                bonus += 0.45 * gaussian_aspect_hit(t_lord, c.asc_lon, 0.0, 2.5, 1.15)

            log_likes.append(min(1.6, bonus))
        return log_likes


class PrimaryDirectionScorer(LikelihoodScorer):
    """Equatorial arc primary direction (~1 degree RA per year of life) directed to natal angles."""

    @property
    def name(self) -> str:
        return "primary_directions"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        if not candidates:
            return []
        event_jd = parse_event_jd(evidence_item)
        if event_jd is None:
            return [0.0] * len(candidates)

        age = exact_age_years(event_jd, candidates[0].jd)
        if age <= 0.0:
            return [0.0] * len(candidates)

        category = normalize_event_category(evidence_item)
        cusp_w = CUSP_WEIGHTS[category]
        direction_arc = age * 0.985647  # Naibod solar mean key (~0.9856 deg/yr)
        orb_cutoff, orb_sigma = 2.0, 0.95

        mid_jd = candidates[len(candidates) // 2].jd
        natal_static = _calc_lons(mid_jd, NATAL_STATIC_PLANETS)

        if category == "career":
            body_weights = {"Sun": 1.20, "Jupiter": 1.15, "Saturn": 1.00, "Moon": 0.95, "Mercury": 0.70, "Venus": 0.45, "Mars": 0.45}
        elif category == "marriage":
            body_weights = {"Venus": 1.30, "Moon": 1.10, "Jupiter": 1.00, "Sun": 0.85, "Mars": 0.65, "Mercury": 0.40, "Saturn": 0.45}
        elif category == "relocation":
            body_weights = {"Moon": 1.25, "Saturn": 1.05, "Jupiter": 1.00, "Sun": 0.85, "Mercury": 0.65, "Venus": 0.50, "Mars": 0.50}
        elif category == "illness":
            body_weights = {"Mars": 1.30, "Saturn": 1.25, "Sun": 1.05, "Moon": 1.00, "Mercury": 0.40, "Venus": 0.30, "Jupiter": 0.35}
        else:
            body_weights = {k: 0.80 for k in ("Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn")}

        log_likes = []
        for c in candidates:
            natal_all = dict(natal_static)
            natal_all["Moon"] = c.moon_lon

            score = 0.0
            for p_name, p_lon in natal_all.items():
                w_body = body_weights[p_name]
                # Deduplicate across angles & squares so 0 deg MC + 90 deg ASC isn't double-counted per natal promissor
                best_body_hit = 0.0
                for role, angle_lon in oriented_angles(c):
                    dir_angle = (angle_lon + direction_arc) % 360.0
                    w_cusp = cusp_w[role]
                    hit_direct = gaussian_aspect_hit(dir_angle, p_lon, 0.0, orb_cutoff, orb_sigma)
                    hit_prom = gaussian_aspect_hit((p_lon + direction_arc) % 360.0, angle_lon, 0.0, orb_cutoff, orb_sigma)
                    best_body_hit = max(best_body_hit, w_cusp * hit_direct, 0.85 * w_cusp * hit_prom)
                for base_lon in (c.asc_lon, c.mc_lon):
                    dir_base = (base_lon + direction_arc) % 360.0
                    sq_d = gaussian_aspect_hit(dir_base, p_lon, 90.0, orb_cutoff, orb_sigma)
                    sq_p = gaussian_aspect_hit((p_lon + direction_arc) % 360.0, base_lon, 90.0, orb_cutoff, orb_sigma)
                    best_body_hit = max(best_body_hit, 0.65 * sq_d, 0.55 * sq_p)
                score += w_body * best_body_hit

            log_likes.append(min(2.0, 1.55 * math.log1p(score)))

        return log_likes


class PhysicalTemperamentScorer(LikelihoodScorer):
    """Sign-affinity likelihood vector capped at a conservative 1.5x ratio (Barnum guard)."""

    @property
    def name(self) -> str:
        return "physical_temperament"

    def score(
        self,
        candidates: List[CandidateMinute],
        evidence_item: Dict[str, Any],
        birth_year: int,
        lat: float,
        lon: float,
    ) -> List[float]:
        affinity = evidence_item.get("affinity", {}) # e.g. {"Scorpio": 1.4, "Cancer": 1.2, "Aries": 0.8}
        log_likes = []
        for c in candidates:
            ratio = float(affinity.get(c.asc_sign, 1.0))
            ratio = max(0.67, min(1.5, ratio)) # Hard cap [0.67, 1.50]
            log_likes.append(math.log(ratio))
        return log_likes


# Scorer Registry
SCORER_REGISTRY: Dict[str, LikelihoodScorer] = {
    "recorded_time": RecordedTimeScorer(),
    "time_clue": TimeClueScorer(),
    "moon_sign": MoonSignScorer(),
    "angular_transits": AngularTransitScorer(),
    "secondary_progressions": SecondaryProgressionScorer(),
    "annual_profections": AnnualProfectionScorer(),
    "primary_directions": PrimaryDirectionScorer(),
    "physical_temperament": PhysicalTemperamentScorer(),
}


# --- Sweep Engine ---

def generate_candidate_minutes(
    year: int,
    month: int,
    day: int,
    lat: float,
    lon: float,
    calendar: str = "gregorian",
    window_start_min: int = 0,
    window_end_min: int = 1439,
    step_minutes: int = 1,
) -> List[CandidateMinute]:
    """Sweeps candidate minutes, computing Placidus ASC, MC, and exact Moon at EVERY candidate minute."""
    cal_flag = swe.JUL_CAL if calendar.lower() == "julian" else swe.GREG_CAL
    candidates = []

    for m in range(window_start_min, window_end_min + 1, step_minutes):
        local_hour = m / 60.0
        ut_hour = local_hour - lon / 15.0 # LMT to UT
        jd = swe.julday(year, month, day, ut_hour, cal_flag)

        # 1. Angles via Placidus
        try:
            cusps, ascmc = swe.houses(jd, lat, lon, b'P')
            asc_lon = ascmc[0] % 360.0
            mc_lon = ascmc[1] % 360.0
        except Exception:
            cusps, ascmc = swe.houses(jd, lat, lon, b'E')
            asc_lon = ascmc[0] % 360.0
            mc_lon = ascmc[1] % 360.0

        asc_sign, _ = deg_to_sign_deg(asc_lon)
        mc_sign, _ = deg_to_sign_deg(mc_lon)

        # 2. Exact Moon recomputed at this minute
        moon_pos, _ = swe.calc_ut(jd, swe.MOON, SWE_FLAGS)
        moon_lon = moon_pos[0] % 360.0
        moon_sign, _ = deg_to_sign_deg(moon_lon)

        h = m // 60
        mi = m % 60
        local_str = f"{h:02d}:{mi:02d}"

        candidates.append(
            CandidateMinute(
                minute=m,
                local_time=local_str,
                jd=jd,
                asc_lon=asc_lon,
                mc_lon=mc_lon,
                asc_sign=asc_sign,
                mc_sign=mc_sign,
                moon_lon=moon_lon,
                moon_sign=moon_sign,
            )
        )

    return candidates


def run_null_baseline_calibration(
    candidates: List[CandidateMinute],
    event_evidence: List[Dict[str, Any]],
    birth_year: int,
    lat: float,
    lon: float,
    num_samples: int = 5,
) -> List[float]:
    """Generates random synthetic dates within [birth_year + 18, birth_year + 70] to measure background noise."""
    if not event_evidence:
        return [0.0] * len(candidates)

    null_log_sum = [0.0] * len(candidates)
    event_scorers = [
        SCORER_REGISTRY["angular_transits"],
        SCORER_REGISTRY["secondary_progressions"],
        SCORER_REGISTRY["annual_profections"],
        SCORER_REGISTRY["primary_directions"],
    ]

    rng = random.Random(42 + birth_year)

    strata = max(6, num_samples * 2)
    span = 48.0
    for idx_s in range(strata):
        for ev in event_evidence:
            base_y = birth_year + 18 + int((idx_s + 0.5) * (span / strata))
            rand_year = max(birth_year + 15, min(birth_year + 72, base_y + rng.randint(-1, 1)))
            rand_month = ((idx_s * 5 + rng.randint(0, 11)) % 12) + 1
            rand_day = rng.randint(1, 28)
            fake_date = f"{rand_year:04d}-{rand_month:02d}-{rand_day:02d}T12:00:00Z"
            fake_ev = dict(ev)
            fake_ev["event_date"] = fake_date

            for scorer in event_scorers:
                scores = scorer.score(candidates, fake_ev, birth_year, lat, lon)
                for i, s in enumerate(scores):
                    null_log_sum[i] += s

    # Average background noise per candidate minute, spatially regularized to prevent Monte Carlo spikes
    count = max(1, strata * len(event_evidence))
    raw_null = [val / count for val in null_log_sum]
    spatial_mean = sum(raw_null) / max(1, len(raw_null))
    return [0.75 * spatial_mean + 0.25 * v for v in raw_null]


# --- Request & Response Models ---

class WindowsRequest(BaseModel):
    year: int
    month: int
    day: int
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    calendar: str = Field("gregorian", description="'gregorian' or 'julian'")


class WindowsResponse(BaseModel):
    rising_windows: List[Dict[str, Any]]
    moon_start: Dict[str, Any]
    moon_end: Dict[str, Any]
    moon_ingress_minute: Optional[int] = None
    moon_ingress_time: Optional[str] = None
    sun_rise_lmt: Optional[str] = None
    sun_set_lmt: Optional[str] = None
    entropy_bits: float = 3.585
    next_best_questions: List[Dict[str, Any]] = Field(default_factory=list)


class RectificationScoreRequest(BaseModel):
    year: int
    month: int
    day: int
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    calendar: str = Field("gregorian", description="'gregorian' or 'julian'")
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    step_minutes: int = Field(1, ge=1, le=10)


class RectificationScoreResponse(BaseModel):
    distribution: Dict[str, float]
    top_sign: str
    top_sign_probability: float
    working_longitude: float
    working_sign: str
    working_time: str
    window_80_minutes: int
    credible_window_80: Dict[str, str]
    certainty: float
    is_calculations_eligible: bool
    evidence_breakdown: List[Dict[str, Any]]
    entropy_bits: float = 0.0
    next_best_questions: List[Dict[str, Any]] = Field(default_factory=list)


# --- Expected Information Gain (EIG) Interviewer Planner ---


def _compute_sun_rise_set(
    year: int,
    month: int,
    day: int,
    lat: float,
    lon: float,
    calendar: str = "gregorian",
) -> Tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
    """Computes local mean sunrise/sunset minutes (`0..1439`) and `HH:MM` strings via Swiss Ephemeris."""
    cal_flag = swe.JUL_CAL if calendar.lower() == "julian" else swe.GREG_CAL
    jd_noon = swe.julday(year, month, day, 12.0 - lon / 15.0, cal_flag)

    rise_res = swe.rise_trans(jd_noon, swe.SUN, swe.CALC_RISE, (lon, lat, 0.0), 0.0, 0.0, swe.FLG_MOSEPH)
    set_res = swe.rise_trans(jd_noon, swe.SUN, swe.CALC_SET, (lon, lat, 0.0), 0.0, 0.0, swe.FLG_MOSEPH)

    sunrise_min: Optional[int] = None
    sunset_min: Optional[int] = None
    sunrise_lmt: Optional[str] = None
    sunset_lmt: Optional[str] = None

    if rise_res[0] == 0:
        ut_h = (rise_res[1][0] - math.floor(rise_res[1][0]) - 0.5) * 24.0
        if ut_h < 0:
            ut_h += 24.0
        lmt_h = (ut_h + lon / 15.0) % 24.0
        sunrise_min = int(round(lmt_h * 60.0)) % 1440
        sunrise_lmt = f"{int(lmt_h):02d}:{int((lmt_h % 1) * 60):02d}"

    if set_res[0] == 0:
        ut_h = (set_res[1][0] - math.floor(set_res[1][0]) - 0.5) * 24.0
        if ut_h < 0:
            ut_h += 24.0
        lmt_h = (ut_h + lon / 15.0) % 24.0
        sunset_min = int(round(lmt_h * 60.0)) % 1440
        sunset_lmt = f"{int(lmt_h):02d}:{int((lmt_h % 1) * 60):02d}"

    return sunrise_min, sunset_min, sunrise_lmt, sunset_lmt


def compute_shannon_entropy_bits(distribution: Dict[str, float]) -> float:
    """Computes base-2 Shannon entropy H(S) = -sum P(s) log2 P(s) over the 12 rising signs."""
    vals = [max(0.0, float(v)) for v in distribution.values()]
    total = sum(vals)
    if total <= 0.0:
        return round(math.log2(12.0), 4)
    h = 0.0
    for v in vals:
        p = v / total
        if p > 1e-12:
            h -= p * math.log2(p)
    return round(max(0.0, h), 4)


def _sign_entropy_from_weights(
    sign_indices: List[int],
    weights: List[float],
) -> Tuple[float, List[float]]:
    sign_totals = [0.0] * 12
    for s_idx, w in zip(sign_indices, weights):
        sign_totals[s_idx] += w
    mass = sum(sign_totals)
    if mass <= 1e-15:
        return 0.0, sign_totals
    h = 0.0
    for v in sign_totals:
        p = v / mass
        if p > 1e-12:
            h -= p * math.log2(p)
    return h, sign_totals


def _conditional_eig_bits(
    sign_indices: List[int],
    prior_weights: List[float],
    h_prior: float,
    outcome_likelihoods: List[List[float]],
) -> Tuple[float, List[float]]:
    """
    Given a channel P(outcome = o | minute i) normalized across outcomes at each candidate i,
    returns `(eig_bits, outcome_marginals)`.
    """
    num_outcomes = len(outcome_likelihoods)
    num_cands = len(prior_weights)
    if num_outcomes < 2 or num_cands == 0 or h_prior <= 1e-6:
        return 0.0, [0.0] * num_outcomes

    # Normalize each candidate minute's likelihoods into a proper probability channel
    cond_entropy = 0.0
    marginals: List[float] = []

    col_sums = [0.0] * num_cands
    for o_idx in range(num_outcomes):
        row = outcome_likelihoods[o_idx]
        for i in range(num_cands):
            col_sums[i] += max(0.0, row[i])

    for o_idx in range(num_outcomes):
        row = outcome_likelihoods[o_idx]
        weighted = [
            prior_weights[i] * (max(0.0, row[i]) / col_sums[i] if col_sums[i] > 1e-15 else 1.0 / num_outcomes)
            for i in range(num_cands)
        ]
        p_o = sum(weighted)
        marginals.append(p_o)
        if p_o > 1e-12:
            h_cond, _ = _sign_entropy_from_weights(sign_indices, weighted)
            cond_entropy += p_o * h_cond

    return max(0.0, h_prior - cond_entropy), marginals


_EVENT_DOMAIN_PROMPTS: Dict[str, Dict[str, Any]] = {
    "career": {
        "question": "When did a major career turning point, public office, debut publication, or vocation breakthrough occur?",
        "rationale": "Public vocation milestones target the Midheaven (MC / 10th house), breaking diurnal 180° quadrant symmetry.",
        "availability": 1.04,
        "cusp": "MC",
        "suggested_label": "Career / Public Milestone (MC)",
    },
    "marriage": {
        "question": "What exact date marked marriage, a primary partnership union, or a major public legal clash?",
        "rationale": "Committed partnership events activate the Descendant (DSC / 7th house) opposite the Ascendant.",
        "availability": 1.02,
        "cusp": "DSC",
        "suggested_label": "Marriage / Partnership Date (DSC)",
    },
    "relocation": {
        "question": "When was a major geographical relocation, founding of a household, or death of a parent?",
        "rationale": "Home, roots, and lineage shifts directly trigger the Imum Coeli (IC / 4th house).",
        "availability": 1.00,
        "cusp": "IC",
        "suggested_label": "Relocation / Parent / Home Event (IC)",
    },
    "illness": {
        "question": "When did a major physical crisis, serious illness, surgery, or bodily vitality turning point happen?",
        "rationale": "Vitality and somatic crises strike the 1st-house Ascendant degree directly.",
        "availability": 0.98,
        "cusp": "ASC",
        "suggested_label": "Physical Crisis / Vitality Shift (ASC)",
    },
}


def _fmt_hhmm(minute: int) -> str:
    m = max(0, min(1439, int(minute)))
    return f"{m // 60:02d}:{m % 60:02d}"


def compute_next_best_questions(
    candidates: List[CandidateMinute],
    minute_probs: List[float],
    sign_distribution: Dict[str, float],
    evidence: List[Dict[str, Any]],
    sunrise_min: Optional[int],
    sunset_min: Optional[int],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Computes adaptive Expected Information Gain (EIG = H(S) - E[H(S|Q)]) in bits across
    highest-leverage unasked evidence families:
      1. Diurnal solar time_clue bands (when neither time_clue nor recorded_time is supplied).
      2. Moon sign ingress check (when Moon changes signs across surviving candidates).
      3. Domain-specific dated life_event categories ranked by cusp geometry separation.
      4. Capped physical_temperament tie-breaker only when top-2 signs remain close.
    """
    n = len(candidates)
    if n == 0:
        return []

    w_sum = sum(max(0.0, float(p)) for p in minute_probs)
    if w_sum > 1e-15:
        weights = [max(0.0, float(p)) / w_sum for p in minute_probs]
    else:
        weights = [1.0 / n] * n

    sign_to_idx = {s: idx for idx, s in enumerate(SIGNS)}
    sign_indices = [sign_to_idx[c.asc_sign] for c in candidates]
    h_prior, _ = _sign_entropy_from_weights(sign_indices, weights)

    if h_prior < 0.04:
        return []

    has_time_evidence = any(
        ev.get("type") in ("time_clue", "recorded_time") for ev in evidence
    )
    has_moon_evidence = any(ev.get("type") == "moon_sign" for ev in evidence)
    has_physical_evidence = any(
        ev.get("type") == "physical_temperament" for ev in evidence
    )
    asked_categories = {
        normalize_event_category(ev)
        for ev in evidence
        if ev.get("type")
        in (
            "life_event",
            "angular_transits",
            "secondary_progressions",
            "annual_profections",
            "primary_directions",
        )
    }

    sorted_signs = sorted(
        sign_distribution.items(), key=lambda kv: kv[1], reverse=True
    )
    top1_sign, top1_prob = sorted_signs[0]
    top2_sign, top2_prob = sorted_signs[1] if len(sorted_signs) > 1 else ("", 0.0)

    questions: List[Dict[str, Any]] = []

    # 1. Diurnal time_clue partition (only when no time_clue/recorded_time exists yet)
    if not has_time_evidence:
        sr = max(180, min(540, sunrise_min if sunrise_min is not None else 360))
        ss = max(900, min(1320, sunset_min if sunset_min is not None else 1080))
        b1 = max(90, sr - 75)          # pre-dawn end (~04:45)
        b2 = min(660, sr + 165)        # dawn / early morning end (~08:45)
        b3 = max(b2 + 90, 780)         # late morning / midday end (~13:00)
        b4 = max(b3 + 90, ss - 20)     # afternoon end (~17:40)

        bands = [
            ("night_pre_dawn", "Late Night / Pre-Dawn", 0, b1),
            ("dawn_early", "Around Sunrise / Early Morning", b1 + 1, b2),
            ("morning_midday", "Late Morning / Midday", b2 + 1, b3),
            ("afternoon", "Afternoon", b3 + 1, b4),
            ("evening_night", "Sunset / Evening / Night", b4 + 1, 1439),
        ]

        sigma_band = 35.0
        two_sig_sq = 2.0 * sigma_band * sigma_band
        band_likelihoods: List[List[float]] = []
        for _id, _lbl, s_min, e_min in bands:
            row: List[float] = []
            for c in candidates:
                m = c.minute
                if s_min <= m <= e_min:
                    row.append(1.0)
                else:
                    dist = min(abs(m - s_min), abs(m - e_min))
                    row.append(math.exp(-(dist * dist) / two_sig_sq))
            band_likelihoods.append(row)

        eig_time, band_marginals = _conditional_eig_bits(
            sign_indices, weights, h_prior, band_likelihoods
        )
        band_options = []
        for idx, (bid, label, s_min, e_min) in enumerate(bands):
            signs_in_band: Dict[str, float] = {}
            for i, c in enumerate(candidates):
                if s_min <= c.minute <= e_min:
                    signs_in_band[c.asc_sign] = signs_in_band.get(c.asc_sign, 0.0) + weights[i]
            likely_signs = [
                k for k, _v in sorted(signs_in_band.items(), key=lambda kv: kv[1], reverse=True)[:3]
            ]
            band_options.append(
                {
                    "id": bid,
                    "label": f"{label} ({_fmt_hhmm(s_min)}–{_fmt_hhmm(e_min)} LMT)",
                    "short_label": label,
                    "type": "time_clue",
                    "start_minute": s_min,
                    "end_minute": e_min,
                    "margin_minutes": 35,
                    "time_range": f"{_fmt_hhmm(s_min)}–{_fmt_hhmm(e_min)}",
                    "estimated_probability": round(band_marginals[idx], 4),
                    "likely_signs": likely_signs,
                }
            )

        questions.append(
            {
                "id": "time_clue_diurnal",
                "type": "time_clue",
                "category": "time_window",
                "expected_ig_bits": round(eig_time, 4),
                "question": "Was the birth in the pre-dawn hours, early morning around sunrise, midday, afternoon, or evening/night?",
                "rationale": "Coarse diurnal windowing breaks the 24-hour Ascendant circle and eliminates 4-quadrant aspect symmetry.",
                "options": band_options,
            }
        )

    # 2. Moon sign ingress check (only when >= 2 Moon signs carry surviving posterior mass)
    if not has_moon_evidence:
        moon_mass: Dict[str, float] = {}
        ingress_minute: Optional[int] = None
        first_moon = candidates[0].moon_sign
        for i, c in enumerate(candidates):
            moon_mass[c.moon_sign] = moon_mass.get(c.moon_sign, 0.0) + weights[i]
            if ingress_minute is None and c.moon_sign != first_moon:
                ingress_minute = c.minute

        active_moon_signs = [
            m for m, mass in sorted(moon_mass.items(), key=lambda kv: kv[1], reverse=True)
            if mass >= 0.02
        ]
        if len(active_moon_signs) >= 2:
            moon_likelihoods: List[List[float]] = []
            for m_sign in active_moon_signs:
                moon_likelihoods.append(
                    [1.0 if c.moon_sign == m_sign else 0.01005 for c in candidates]
                )
            eig_moon, moon_marginals = _conditional_eig_bits(
                sign_indices, weights, h_prior, moon_likelihoods
            )
            if eig_moon >= 0.015:
                ingress_str = _fmt_hhmm(ingress_minute) if ingress_minute is not None else "unknown"
                moon_options = []
                for idx, m_sign in enumerate(active_moon_signs):
                    signs_here: Dict[str, float] = {}
                    for i, c in enumerate(candidates):
                        if c.moon_sign == m_sign:
                            signs_here[c.asc_sign] = signs_here.get(c.asc_sign, 0.0) + weights[i]
                    likely_signs = [
                        k for k, _v in sorted(signs_here.items(), key=lambda kv: kv[1], reverse=True)[:3]
                    ]
                    moon_options.append(
                        {
                            "id": f"moon_{m_sign.lower()}",
                            "label": f"Moon in {m_sign}",
                            "type": "moon_sign",
                            "moon_sign": m_sign,
                            "estimated_probability": round(moon_marginals[idx], 4),
                            "likely_signs": likely_signs,
                        }
                    )

                questions.append(
                    {
                        "id": "moon_sign_ingress",
                        "type": "moon_sign",
                        "category": "lunar_ingress",
                        "expected_ig_bits": round(eig_moon, 4),
                        "ingress_time": ingress_str,
                        "question": f"The Moon changed signs into {active_moon_signs[1]} around {ingress_str} LMT — which Moon temperament matches ({' vs '.join(active_moon_signs[:2])})?",
                        "rationale": f"Lunar sign ingress at ~{ingress_str} LMT sharply bifurcates the remaining sky into pre-ingress and post-ingress windows.",
                        "options": moon_options,
                    }
                )

    # 3. Domain-specific dated life events (career -> MC, marriage -> DSC, relocation -> IC, illness -> ASC)
    zodiac_centers = [k * 30.0 + 15.0 for k in range(12)]
    unasked_domains = [
        cat for cat in ("career", "marriage", "relocation", "illness")
        if cat not in asked_categories
    ]
    for cat in unasked_domains:
        meta = _EVENT_DOMAIN_PROMPTS[cat]
        cusp = meta["cusp"]
        domain_outcomes: List[List[float]] = []

        for k_idx, z_center in enumerate(zodiac_centers):
            row: List[float] = []
            for c in candidates:
                if cusp == "MC":
                    primary_lon = c.mc_lon
                elif cusp == "DSC":
                    primary_lon = (c.asc_lon + 180.0) % 360.0
                elif cusp == "IC":
                    primary_lon = (c.mc_lon + 180.0) % 360.0
                else:
                    primary_lon = c.asc_lon

                d_prim = angular_difference(primary_lon, z_center)
                d_opp = angular_difference((primary_lon + 180.0) % 360.0, z_center)
                aff = 1.60 * math.exp(-((d_prim / 18.0) ** 2)) + 0.50 * math.exp(-((d_opp / 18.0) ** 2))
                if sign_to_idx[c.asc_sign] == k_idx:
                    aff += 0.80
                row.append(math.exp(aff))
            domain_outcomes.append(row)

        eig_dom, _ = _conditional_eig_bits(
            sign_indices, weights, h_prior, domain_outcomes
        )
        weighted_eig = eig_dom * meta["availability"]
        if weighted_eig >= 0.01:
            questions.append(
                {
                    "id": f"life_event_{cat}",
                    "type": "life_event",
                    "category": cat,
                    "cusp": cusp,
                    "expected_ig_bits": round(weighted_eig, 4),
                    "question": meta["question"],
                    "rationale": meta["rationale"],
                    "competing_signs": [
                        {"sign": s, "probability": round(p, 4)}
                        for s, p in sorted_signs[:3]
                        if p >= 0.05
                    ],
                }
            )

    # 4. Capped physical_temperament tie-breaker ONLY when top-2 signs remain close AFTER time + event evidence
    top_gap = top1_prob - top2_prob
    if (
        not has_physical_evidence
        and top1_prob < 0.70
        and top2_prob >= 0.12
        and len(asked_categories) >= 1
        and (has_time_evidence or h_prior <= 1.50)
        and top_gap <= 0.25
    ):
        # Strictly capped Barnum-safe binary preference across top-2 signs (ratio <= 1.5x)
        phys_outcomes: List[List[float]] = [
            [
                1.50 if c.asc_sign == top1_sign else (0.67 if c.asc_sign == top2_sign else 1.0)
                for c in candidates
            ],
            [
                1.50 if c.asc_sign == top2_sign else (0.67 if c.asc_sign == top1_sign else 1.0)
                for c in candidates
            ],
        ]
        raw_eig_phys, phys_marginals = _conditional_eig_bits(
            sign_indices, weights, h_prior, phys_outcomes
        )
        eig_phys = min(0.10, raw_eig_phys)
        if eig_phys >= 0.005:
            questions.append(
                {
                    "id": "physical_temperament_tiebreak",
                    "type": "physical_temperament",
                    "category": "temperament",
                    "expected_ig_bits": round(eig_phys, 4),
                    "question": f"As a gentle tie-breaker between {top1_sign} and {top2_sign} rising: which outwardly observable demeanor fits better?",
                    "rationale": "Post-event residual ties between top-2 signs use a Barnum-guarded (<= 1.5x likelihood cap) demeanor check.",
                    "options": [
                        {
                            "id": f"phys_{top1_sign.lower()}",
                            "label": f"Closer to {top1_sign} Rising demeanor",
                            "type": "physical_temperament",
                            "affinity": {top1_sign: 1.5, top2_sign: 0.67},
                            "estimated_probability": round(phys_marginals[0], 4),
                        },
                        {
                            "id": f"phys_{top2_sign.lower()}",
                            "label": f"Closer to {top2_sign} Rising demeanor",
                            "type": "physical_temperament",
                            "affinity": {top2_sign: 1.5, top1_sign: 0.67},
                            "estimated_probability": round(phys_marginals[1], 4),
                        },
                    ],
                }
            )

    questions.sort(key=lambda q: q["expected_ig_bits"], reverse=True)
    for rank, q in enumerate(questions, start=1):
        q["rank"] = rank
    return questions[:top_k]


# --- Endpoints ---

@router.post("/windows", response_model=WindowsResponse)
def post_rectify_windows(payload: WindowsRequest):
    """Calculates 24-hour rising sign windows, Moon motion, and solar bounds."""
    candidates = generate_candidate_minutes(
        year=payload.year,
        month=payload.month,
        day=payload.day,
        lat=payload.latitude,
        lon=payload.longitude,
        calendar=payload.calendar,
        step_minutes=2,
    )

    windows = []
    current_sign = None
    start_min = 0

    for c in candidates:
        if c.asc_sign != current_sign:
            if current_sign is not None:
                duration = c.minute - start_min
                windows.append({
                    "sign": current_sign,
                    "start_time": f"{start_min//60:02d}:{start_min%60:02d}",
                    "end_time": c.local_time,
                    "duration_minutes": duration,
                    "prior_probability": round(duration / 1440.0, 4),
                })
            current_sign = c.asc_sign
            start_min = c.minute

    if current_sign is not None:
        duration = 1440 - start_min
        windows.append({
            "sign": current_sign,
            "start_time": f"{start_min//60:02d}:{start_min%60:02d}",
            "end_time": "24:00",
            "duration_minutes": duration,
            "prior_probability": round(duration / 1440.0, 4),
        })

    # Moon ingress detection
    m_first = candidates[0]
    m_last = candidates[-1]
    ingress_min = None
    ingress_str = None
    for c in candidates:
        if c.moon_sign != m_first.moon_sign:
            ingress_min = c.minute
            ingress_str = c.local_time
            break

    # Sunrise/Sunset calculation via shared Swiss Ephemeris helper
    sunrise_min, sunset_min, sunrise_lmt, sunset_lmt = _compute_sun_rise_set(
        payload.year,
        payload.month,
        payload.day,
        payload.latitude,
        payload.longitude,
        payload.calendar,
    )

    # Prior sign distribution from 24-hour rising window durations
    uniform_probs = [1.0 / len(candidates)] * len(candidates) if candidates else []
    prior_sign_dist: Dict[str, float] = {s: 0.0 for s in SIGNS}
    for c in candidates:
        prior_sign_dist[c.asc_sign] += 1.0 / len(candidates)
    prior_entropy_bits = compute_shannon_entropy_bits(prior_sign_dist)
    next_questions = compute_next_best_questions(
        candidates=candidates,
        minute_probs=uniform_probs,
        sign_distribution=prior_sign_dist,
        evidence=[],
        sunrise_min=sunrise_min,
        sunset_min=sunset_min,
    )

    return WindowsResponse(
        rising_windows=windows,
        moon_start={"sign": m_first.moon_sign, "longitude": round(m_first.moon_lon, 2)},
        moon_end={"sign": m_last.moon_sign, "longitude": round(m_last.moon_lon, 2)},
        moon_ingress_minute=ingress_min,
        moon_ingress_time=ingress_str,
        sun_rise_lmt=sunrise_lmt,
        sun_set_lmt=sunset_lmt,
        entropy_bits=prior_entropy_bits,
        next_best_questions=next_questions,
    )


@router.post("/score", response_model=RectificationScoreResponse)
def post_rectify_score(payload: RectificationScoreRequest):
    """Executes full Bayesian posterior estimation across all evidence items with null-baseline calibration."""
    step = payload.step_minutes
    candidates = generate_candidate_minutes(
        year=payload.year,
        month=payload.month,
        day=payload.day,
        lat=payload.latitude,
        lon=payload.longitude,
        calendar=payload.calendar,
        step_minutes=step,
    )
    n = len(candidates)

    log_posterior = [0.0] * n
    breakdown = []

    # Separate event evidence from static priors
    event_evidence = [ev for ev in payload.evidence if ev.get("type") in ("angular_transits", "secondary_progressions", "annual_profections", "primary_directions", "life_event")]
    null_baseline = run_null_baseline_calibration(candidates, event_evidence, payload.year, payload.latitude, payload.longitude)

    # Process each evidence item
    for ev in payload.evidence:
        ev_type = ev.get("type")
        scorer = SCORER_REGISTRY.get(ev_type)
        if not scorer:
            # Check if it's a generic life event -> evaluate across all 4 western timing scorers
            if ev_type == "life_event":
                total_ev_log = [0.0] * n
                for sub_scorer in (SCORER_REGISTRY["angular_transits"], SCORER_REGISTRY["secondary_progressions"], SCORER_REGISTRY["annual_profections"], SCORER_REGISTRY["primary_directions"]):
                    sub_res = sub_scorer.score(candidates, ev, payload.year, payload.latitude, payload.longitude)
                    for i in range(n):
                        total_ev_log[i] += sub_res[i]
                # Apply null baseline discount with sublinear single-event outlier compression
                discounted_log = []
                for i in range(n):
                    raw_excess = max(0.0, total_ev_log[i] - null_baseline[i])
                    net = 2.15 * math.log1p(raw_excess / 1.30)
                    discounted_log.append(net)
                    log_posterior[i] += net
                breakdown.append({
                    "evidence": ev.get("description", "Life Event"),
                    "type": ev_type,
                    "max_log_shift": round(max(discounted_log), 3),
                    "min_log_shift": round(min(discounted_log), 3),
                    "null_discount_applied": True,
                })
            continue

        scores = scorer.score(candidates, ev, payload.year, payload.latitude, payload.longitude)
        for i in range(n):
            log_posterior[i] += scores[i]

        breakdown.append({
            "evidence": ev.get("description", ev_type),
            "type": ev_type,
            "max_log_shift": round(max(scores), 3),
            "min_log_shift": round(min(scores), 3),
            "null_discount_applied": False,
        })

    # Softmax normalization across minutes
    max_log = max(log_posterior)
    exp_scores = [math.exp(lp - max_log) for lp in log_posterior]
    total_exp = sum(exp_scores)
    minute_probs = [s / total_exp for s in exp_scores]

    # Aggregate into 12-sign distribution
    sign_distribution: Dict[str, float] = {s: 0.0 for s in SIGNS}
    for i, c in enumerate(candidates):
        sign_distribution[c.asc_sign] += minute_probs[i]

    # Round distribution
    for s in SIGNS:
        sign_distribution[s] = round(sign_distribution[s], 4)

    # MAP candidate
    top_minute_idx = int(max(range(n), key=lambda i: minute_probs[i]))
    map_candidate = candidates[top_minute_idx]

    top_sign = max(sign_distribution.keys(), key=lambda k: sign_distribution[k])
    top_sign_prob = sign_distribution[top_sign]

    # 80% credible window
    sorted_by_prob = sorted(range(n), key=lambda i: minute_probs[i], reverse=True)
    accum = 0.0
    credible_indices = []
    for idx in sorted_by_prob:
        accum += minute_probs[idx]
        credible_indices.append(idx)
        if accum >= 0.80:
            break

    window_80_mins = len(credible_indices) * step
    min_credible_min = min(candidates[i].minute for i in credible_indices)
    max_credible_min = max(candidates[i].minute for i in credible_indices)
    cred_start = f"{min_credible_min//60:02d}:{min_credible_min%60:02d}"
    cred_end = f"{max_credible_min//60:02d}:{max_credible_min%60:02d}"

    # Entropy & Certainty: H = -sum(p * log p); normalized by log(12)
    entropy = 0.0
    for p in sign_distribution.values():
        if p > 1e-7:
            entropy -= p * math.log(p)
    certainty = max(0.0, min(1.0, 1.0 - (entropy / math.log(12.0))))
    entropy_bits = compute_shannon_entropy_bits(sign_distribution)

    # Eligibility for calculations threshold
    is_eligible = (top_sign_prob >= 0.70 and window_80_mins <= 180)

    sunrise_min, sunset_min, _sr_str, _ss_str = _compute_sun_rise_set(
        payload.year,
        payload.month,
        payload.day,
        payload.latitude,
        payload.longitude,
        payload.calendar,
    )
    next_questions = compute_next_best_questions(
        candidates=candidates,
        minute_probs=minute_probs,
        sign_distribution=sign_distribution,
        evidence=payload.evidence,
        sunrise_min=sunrise_min,
        sunset_min=sunset_min,
    )

    return RectificationScoreResponse(
        distribution=sign_distribution,
        top_sign=top_sign,
        top_sign_probability=round(top_sign_prob, 4),
        working_longitude=round(map_candidate.asc_lon, 2),
        working_sign=map_candidate.asc_sign,
        working_time=map_candidate.local_time,
        window_80_minutes=window_80_mins,
        credible_window_80={"startLocal": cred_start, "endLocal": cred_end},
        certainty=round(certainty, 4),
        is_calculations_eligible=is_eligible,
        evidence_breakdown=breakdown,
        entropy_bits=entropy_bits,
        next_best_questions=next_questions,
    )


# --- Held-Out Benchmark Dataset for the 20 Timed Ground-Truth Agents ---

BENCHMARK_CASES = [
    {
        "id": "albert-einstein",
        "name": "Albert Einstein",
        "birth": {"year": 1879, "month": 3, "day": 14, "lat": 48.4011, "lon": 9.9876, "cal": "gregorian"},
        "ground_truth": {"time": "11:30", "sign": "Cancer", "asc": 101.65},
        "events": [
            {"type": "life_event", "category": "career", "description": "Annus Mirabilis papers submitted", "date": "1905-06-30"},
            {"type": "life_event", "category": "career", "description": "Awarded Nobel Prize in Physics", "date": "1921-11-09"},
        ],
    },
    {
        "id": "sigmund-freud",
        "name": "Sigmund Freud",
        "birth": {"year": 1856, "month": 5, "day": 6, "lat": 49.6116, "lon": 17.2381, "cal": "gregorian"},
        "ground_truth": {"time": "18:30", "sign": "Scorpio", "asc": 217.52},
        "events": [
            {"type": "life_event", "category": "career", "description": "Publication of The Interpretation of Dreams", "date": "1899-11-04"},
            {"type": "life_event", "category": "illness", "description": "First major oral surgery for cancer", "date": "1923-04-01"},
        ],
    },
    {
        "id": "carl-jung",
        "name": "Carl Jung",
        "birth": {"year": 1875, "month": 7, "day": 26, "lat": 47.6, "lon": 9.3, "cal": "gregorian"},
        "ground_truth": {"time": "19:32", "sign": "Aquarius", "asc": 301.55},
        "events": [
            {"type": "life_event", "category": "marriage", "description": "Break with Freud and onset of Red Book visions", "date": "1913-10-27"},
            {"type": "life_event", "category": "illness", "description": "Near death experience and heart attack", "date": "1944-02-14"},
        ],
    },
    {
        "id": "frida-kahlo",
        "name": "Frida Kahlo",
        "birth": {"year": 1907, "month": 7, "day": 6, "lat": 19.3, "lon": -99.2, "cal": "gregorian"},
        "ground_truth": {"time": "08:30", "sign": "Leo", "asc": 143.51},
        "events": [
            {"type": "life_event", "category": "illness", "description": "Severe bus collision resulting in multiple fractures", "date": "1925-09-17"},
            {"type": "life_event", "category": "marriage", "description": "Marriage to Diego Rivera", "date": "1929-08-21"},
        ],
    },
    {
        "id": "vincent-van-gogh",
        "name": "Vincent van Gogh",
        "birth": {"year": 1853, "month": 3, "day": 30, "lat": 51.4408, "lon": 5.4798, "cal": "gregorian"},
        "ground_truth": {"time": "11:00", "sign": "Cancer", "asc": 111.13},
        "events": [
            {"type": "life_event", "category": "illness", "description": "Ear severance incident in Arles", "date": "1888-12-23"},
            {"type": "life_event", "category": "illness", "description": "Gunshot injury and death in Auvers", "date": "1890-07-29"},
        ],
    },
    {
        "id": "marie-curie",
        "name": "Marie Curie",
        "birth": {"year": 1867, "month": 11, "day": 7, "lat": 52.2297, "lon": 21.0122, "cal": "gregorian"},
        "ground_truth": {"time": "12:00", "sign": "Capricorn", "asc": 282.06},
        "events": [
            {"type": "life_event", "category": "career", "description": "Awarded Nobel Prize in Physics", "date": "1903-12-10"},
            {"type": "life_event", "category": "marriage", "description": "Pierre Curie killed in carriage accident", "date": "1906-04-19"},
            {"type": "life_event", "category": "career", "description": "Awarded second Nobel Prize in Chemistry", "date": "1911-12-10"},
        ],
    },
    {
        "id": "wolfgang-amadeus-mozart",
        "name": "Wolfgang Amadeus Mozart",
        "birth": {"year": 1756, "month": 1, "day": 27, "lat": 47.8095, "lon": 13.055, "cal": "gregorian"},
        "ground_truth": {"time": "20:00", "sign": "Virgo", "asc": 162.69},
        "events": [
            {"type": "life_event", "category": "marriage", "description": "Marriage to Constanze Weber in Vienna", "date": "1782-08-04"},
            {"type": "life_event", "category": "career", "description": "Premiere of Le Nozze di Figaro", "date": "1786-05-01"},
        ],
    },
    {
        "id": "johannes-kepler",
        "name": "Johannes Kepler",
        "birth": {"year": 1571, "month": 12, "day": 27, "lat": 48.8915, "lon": 8.7044, "cal": "julian"},
        "ground_truth": {"time": "14:37", "sign": "Gemini", "asc": 84.58},
        "events": [
            {"type": "life_event", "category": "relocation", "description": "Arrival at Tycho Brahe observatory at Benátky", "date": "1600-02-04"},
            {"type": "life_event", "category": "career", "description": "Publication of Astronomia Nova", "date": "1609-08-01"},
        ],
    },
    {
        "id": "galileo-galilei",
        "name": "Galileo Galilei",
        "birth": {"year": 1564, "month": 2, "day": 15, "lat": 43.7228, "lon": 10.4017, "cal": "julian"},
        "ground_truth": {"time": "15:31", "sign": "Leo", "asc": 131.95},
        "events": [
            {"type": "life_event", "category": "career", "description": "First telescopic observation of Jupiter moons", "date": "1610-01-07"},
            {"type": "life_event", "category": "marriage", "description": "Inquisition sentencing and house arrest in Rome", "date": "1633-06-22"},
        ],
    },
    {
        "id": "nikola-tesla",
        "name": "Nikola Tesla",
        "birth": {"year": 1856, "month": 7, "day": 10, "lat": 44.5167, "lon": 15.3, "cal": "gregorian"},
        "ground_truth": {"time": "00:00", "sign": "Taurus", "asc": 32.82},
        "events": [
            {"type": "life_event", "category": "career", "description": "Historic AIEE presentation of AC induction motor", "date": "1888-05-16"},
            {"type": "life_event", "category": "illness", "description": "South 5th Ave laboratory destroyed by fire", "date": "1895-03-13"},
        ],
    },
    {
        "id": "charles-dickens",
        "name": "Charles Dickens",
        "birth": {"year": 1812, "month": 2, "day": 7, "lat": 50.8037, "lon": -1.0825, "cal": "gregorian"},
        "ground_truth": {"time": "19:50", "sign": "Virgo", "asc": 168.83},
        "events": [
            {"type": "life_event", "category": "marriage", "description": "Marriage to Catherine Hogarth; Pickwick begins", "date": "1836-04-02"},
            {"type": "life_event", "category": "career", "description": "Publication of A Christmas Carol", "date": "1843-12-19"},
        ],
    },
    {
        "id": "eleanor-roosevelt",
        "name": "Eleanor Roosevelt",
        "birth": {"year": 1884, "month": 10, "day": 11, "lat": 40.7128, "lon": -74.006, "cal": "gregorian"},
        "ground_truth": {"time": "11:00", "sign": "Sagittarius", "asc": 256.61},
        "events": [
            {"type": "life_event", "category": "marriage", "description": "Marriage to Franklin D. Roosevelt", "date": "1905-03-17"},
            {"type": "life_event", "category": "career", "description": "UN General Assembly adopts Universal Declaration of Human Rights", "date": "1948-12-10"},
        ],
    },
    {
        "id": "carl-sagan",
        "name": "Carl Sagan",
        "birth": {"year": 1934, "month": 11, "day": 9, "lat": 40.6782, "lon": -73.9442, "cal": "gregorian"},
        "ground_truth": {"time": "17:05", "sign": "Taurus", "asc": 55.36},
        "events": [
            {"type": "life_event", "category": "career", "description": "Launch of Voyager 2 carrying interstellar Golden Record", "date": "1977-08-20"},
            {"type": "life_event", "category": "career", "description": "Broadcast premiere of Cosmos on television", "date": "1980-09-28"},
        ],
    },
    {
        "id": "maya-angelou",
        "name": "Maya Angelou",
        "birth": {"year": 1928, "month": 4, "day": 4, "lat": 38.627, "lon": -90.1994, "cal": "gregorian"},
        "ground_truth": {"time": "14:10", "sign": "Leo", "asc": 143.97},
        "events": [
            {"type": "life_event", "category": "career", "description": "Publication of I Know Why the Caged Bird Sings", "date": "1969-10-01"},
            {"type": "life_event", "category": "career", "description": "Recitation of On the Pulse of Morning at Presidential Inauguration", "date": "1993-01-20"},
        ],
    },
    {
        "id": "immanuel-kant",
        "name": "Immanuel Kant",
        "birth": {"year": 1724, "month": 4, "day": 22, "lat": 54.7065, "lon": 20.5119, "cal": "gregorian"},
        "ground_truth": {"time": "05:00", "sign": "Taurus", "asc": 39.46},
        "events": [
            {"type": "life_event", "category": "career", "description": "Appointed Professor of Logic and Metaphysics at Königsberg", "date": "1770-08-21"},
            {"type": "life_event", "category": "career", "description": "Publication of Critique of Pure Reason", "date": "1781-05-01"},
        ],
    },
    {
        "id": "machiavelli",
        "name": "Niccolò Machiavelli",
        "birth": {"year": 1469, "month": 5, "day": 3, "lat": 43.7696, "lon": 11.2558, "cal": "julian"},
        "ground_truth": {"time": "23:07", "sign": "Capricorn", "asc": 282.38},
        "events": [
            {"type": "life_event", "category": "career", "description": "Appointed Second Chancellor of the Republic of Florence", "date": "1498-06-19"},
            {"type": "life_event", "category": "career", "description": "Letter to Vettori announcing completion of The Prince", "date": "1513-12-10"},
        ],
    },
    {
        "id": "michelangelo",
        "name": "Michelangelo Buonarroti",
        "birth": {"year": 1475, "month": 3, "day": 6, "lat": 43.6414, "lon": 11.9847, "cal": "julian"},
        "ground_truth": {"time": "01:45", "sign": "Sagittarius", "asc": 264.50},
        "events": [
            {"type": "life_event", "category": "career", "description": "Public unveiling of the colossal David statue in Florence", "date": "1504-09-08"},
            {"type": "life_event", "category": "career", "description": "Inauguration and public viewing of the Sistine Chapel ceiling", "date": "1512-10-31"},
        ],
    },
    {
        "id": "isaac-asimov",
        "name": "Isaac Asimov",
        "birth": {"year": 1920, "month": 1, "day": 2, "lat": 53.9753, "lon": 32.1583, "cal": "gregorian"},
        "ground_truth": {"time": "15:35", "sign": "Cancer", "asc": 99.69},
        "events": [
            {"type": "life_event", "category": "career", "description": "Publication of Nightfall in Astounding Science Fiction", "date": "1941-09-01"},
            {"type": "life_event", "category": "career", "description": "Publication of Foundation as fix-up novel", "date": "1951-05-01"},
        ],
    },
    {
        "id": "paulo-freire",
        "name": "Paulo Freire",
        "birth": {"year": 1921, "month": 9, "day": 19, "lat": -8.0476, "lon": -34.877, "cal": "gregorian"},
        "ground_truth": {"time": "15:45", "sign": "Aquarius", "asc": 323.98},
        "events": [
            {"type": "life_event", "category": "illness", "description": "Arrest and imprisonment following Brazilian military coup", "date": "1964-06-01"},
            {"type": "life_event", "category": "career", "description": "Completion of Pedagogy of the Oppressed manuscript in Chile", "date": "1968-12-01"},
        ],
    },
    {
        "id": "wangari-maathai",
        "name": "Wangari Maathai",
        "birth": {"year": 1940, "month": 4, "day": 1, "lat": -0.4201, "lon": 36.9476, "cal": "gregorian"},
        "ground_truth": {"time": "14:30", "sign": "Leo", "asc": 134.61},
        "events": [
            {"type": "life_event", "category": "career", "description": "Founding of the Green Belt Movement on World Environment Day", "date": "1977-06-05"},
            {"type": "life_event", "category": "career", "description": "Awarded the Nobel Peace Prize in Oslo", "date": "2004-10-08"},
        ],
    },
]


@router.get("/benchmark")
def get_rectification_benchmark(step_minutes: int = 5):
    """Executes a blind back-test across the 20 held-out measured charts, hiding the known birth time,

    scoring only against dated biographical events (plus a +/-2.5h coarse time-clue comparison),
    and reporting top-1, MAP-sign, top-3 hit rates, and false-positive calculation-eligibility safety.
    """
    results = []
    top_1_hits = 0
    map_1_hits = 0
    top_3_hits = 0
    false_positive_eligible = 0
    total_angular_error = 0.0

    cw_top_1 = 0
    cw_map_1 = 0
    cw_top_3 = 0
    cw_eligible_ok = 0
    cw_false_positive = 0
    cw_angular_error = 0.0

    for case in BENCHMARK_CASES:
        b = case["birth"]
        gt = case["ground_truth"]
        req = RectificationScoreRequest(
            year=b["year"],
            month=b["month"],
            day=b["day"],
            latitude=b["lat"],
            longitude=b["lon"],
            calendar=b["cal"],
            evidence=case["events"],
            step_minutes=step_minutes,
        )

        res = post_rectify_score(req)

        sorted_signs = sorted(res.distribution.keys(), key=lambda s: res.distribution[s], reverse=True)
        top_1 = sorted_signs[0]
        top_3 = sorted_signs[:3]

        true_sign = gt["sign"]
        true_asc = gt["asc"]

        is_top_1 = (top_1 == true_sign)
        is_map_1 = (res.working_sign == true_sign)
        is_top_3 = (true_sign in top_3)

        if is_top_1:
            top_1_hits += 1
        if is_map_1:
            map_1_hits += 1
        if is_top_3:
            top_3_hits += 1
        if res.is_calculations_eligible and not is_top_1:
            false_positive_eligible += 1

        diff = abs(((res.working_longitude - true_asc + 180.0) % 360.0) - 180.0)
        total_angular_error += diff

        # Coarse +/-2.5h window test (simulates archival morning/evening/night clues)
        hh, mm = map(int, gt["time"].split(":"))
        center_min = hh * 60 + mm
        cw_evidence = list(case["events"]) + [{
            "type": "time_clue",
            "start_minute": max(0, center_min - 150),
            "end_minute": min(1439, center_min + 150),
            "margin_minutes": 45,
        }]
        cw_res = post_rectify_score(RectificationScoreRequest(
            year=b["year"],
            month=b["month"],
            day=b["day"],
            latitude=b["lat"],
            longitude=b["lon"],
            calendar=b["cal"],
            evidence=cw_evidence,
            step_minutes=step_minutes,
        ))
        cw_sorted = sorted(cw_res.distribution.keys(), key=lambda s: cw_res.distribution[s], reverse=True)
        if cw_res.top_sign == true_sign:
            cw_top_1 += 1
            if cw_res.is_calculations_eligible:
                cw_eligible_ok += 1
        elif cw_res.is_calculations_eligible:
            cw_false_positive += 1
        if cw_res.working_sign == true_sign:
            cw_map_1 += 1
        if true_sign in cw_sorted[:3]:
            cw_top_3 += 1
        cw_diff = abs(((cw_res.working_longitude - true_asc + 180.0) % 360.0) - 180.0)
        cw_angular_error += cw_diff

        results.append({
            "id": case["id"],
            "name": case["name"],
            "true_time": gt["time"],
            "true_sign": true_sign,
            "true_asc": true_asc,
            "predicted_time": res.working_time,
            "predicted_sign": top_1,
            "working_sign": res.working_sign,
            "predicted_asc": res.working_longitude,
            "top_sign_probability": res.top_sign_probability,
            "top_1_hit": is_top_1,
            "map_1_hit": is_map_1,
            "top_3_hit": is_top_3,
            "top_3_signs": top_3,
            "angular_error_deg": round(diff, 2),
            "certainty": res.certainty,
            "window_80_minutes": res.window_80_minutes,
            "is_calculations_eligible": res.is_calculations_eligible,
            "coarse_window_predicted_sign": cw_res.top_sign,
            "coarse_window_error_deg": round(cw_diff, 2),
        })

    total_cases = len(BENCHMARK_CASES)
    return {
        "benchmark_summary": {
            "total_cases": total_cases,
            "top_1_hits": top_1_hits,
            "top_1_accuracy": round(top_1_hits / total_cases, 4),
            "map_1_hits": map_1_hits,
            "map_1_accuracy": round(map_1_hits / total_cases, 4),
            "top_3_hits": top_3_hits,
            "top_3_accuracy": round(top_3_hits / total_cases, 4),
            "false_positive_eligible": false_positive_eligible,
            "mean_angular_error_deg": round(total_angular_error / total_cases, 2),
            "step_minutes_evaluated": step_minutes,
        },
        "coarse_window_summary": {
            "window_half_width_minutes": 150,
            "total_cases": total_cases,
            "top_1_hits": cw_top_1,
            "top_1_accuracy": round(cw_top_1 / total_cases, 4),
            "map_1_hits": cw_map_1,
            "map_1_accuracy": round(cw_map_1 / total_cases, 4),
            "top_3_hits": cw_top_3,
            "top_3_accuracy": round(cw_top_3 / total_cases, 4),
            "eligible_correct": cw_eligible_ok,
            "false_positive_eligible": cw_false_positive,
            "mean_angular_error_deg": round(cw_angular_error / total_cases, 2),
        },
        "results": results,
    }


class ProposalScoreRequest(BaseModel):
    evidence: Optional[List[Dict[str, Any]]] = None
    step_minutes: int = Field(5, ge=1, le=10)


def _import_dossiers_module():
    try:
        from backend import rectification_dossiers  # type: ignore
        return rectification_dossiers
    except ImportError:
        import rectification_dossiers  # type: ignore
        return rectification_dossiers


@router.get("/proposals")
def get_rectification_proposals():
    """Lists all curated unmeasured/undated historical agent dossiers without blocking on 24h sweeps."""
    dossiers_mod = _import_dossiers_module()
    proposals = dossiers_mod.list_proposals_metadata()
    return {"count": len(proposals), "proposals": proposals}


@router.post("/proposals/{agent_id}/score")
def post_score_rectification_proposal(
    agent_id: str,
    payload: Optional[ProposalScoreRequest] = None,
):
    """Scores a specific curated historical agent dossier (or custom evidence override) via Swiss Ephemeris."""
    dossiers_mod = _import_dossiers_module()
    req_body = payload or ProposalScoreRequest()
    try:
        return dossiers_mod.score_dossier(
            agent_id,
            override_evidence=req_body.evidence,
            step_minutes=req_body.step_minutes,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/proposals/score-all")
def post_score_all_rectification_proposals(
    classification: Optional[str] = None,
    step_minutes: int = 5,
):
    """Batch-scores all rectifiable dossiers (optionally filtered by classification)."""
    dossiers_mod = _import_dossiers_module()
    proposals = dossiers_mod.score_all_rectifiable_dossiers(
        classification_filter=classification,
        step_minutes=max(1, min(10, step_minutes)),
    )
    return {"count": len(proposals), "proposals": proposals}


def _to_json_dict(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return obj


def _cli_main(argv: Optional[List[str]] = None) -> int:
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(description="Standalone CLI for Swiss Ephemeris rectification")
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in ("windows", "score"):
        p = sub.add_parser(name)
        p.add_argument("--json", dest="raw_json", default=None, help="JSON payload string")
        p.add_argument("--stdin", action="store_true", help="Read JSON payload from stdin")

    args = parser.parse_args(argv)
    raw = sys.stdin.read() if args.stdin or args.raw_json is None else args.raw_json
    data = json.loads(raw)

    if args.cmd == "windows":
        res = post_rectify_windows(WindowsRequest(**data))
    else:
        res = post_rectify_score(RectificationScoreRequest(**data))

    print(json.dumps(_to_json_dict(res)))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli_main())
