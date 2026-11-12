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
from datetime import datetime, timezone
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


# --- Helpers ---

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

        # Check hits to angles: Ascendant (0), Midheaven (90 from IC), IC, Descendant
        # Hard aspects: conjunction (0), square (90), opposition (180)
        orb_max = 2.0 # degrees
        two_orb_sq = 2.0 * (orb_max ** 2)

        log_likes = []
        for c in candidates:
            hit_score = 0.0
            angles = [c.asc_lon, c.mc_lon, (c.asc_lon + 180.0) % 360.0, (c.mc_lon + 180.0) % 360.0]
            for t_lon in transiting_lons:
                for angle in angles:
                    diff = angular_difference(t_lon, angle)
                    # Check conjunction (0), square (90), or opposition (180)
                    for target in (0.0, 90.0, 180.0):
                        dist = aspect_orb(diff, target)
                        if dist <= orb_max:
                            # Strong aspect bonus
                            hit_score += math.exp(-(dist * dist) / two_orb_sq)
            # Scale to conservative log likelihood
            log_likes.append(min(1.5, hit_score * 0.4))
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
        event_date_str = evidence_item.get("event_date") or evidence_item.get("date") or evidence_item.get("date")
        if not event_date_str:
            return [0.0] * len(candidates)

        try:
            dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
            years_elapsed = max(0.0, (dt.year - birth_year) + (dt.month - 1) / 12.0)
        except Exception:
            return [0.0] * len(candidates)

        if years_elapsed <= 0:
            return [0.0] * len(candidates)

        log_likes = []
        orb_max = 1.5
        two_orb_sq = 2.0 * (orb_max ** 2)

        for c in candidates:
            # Progressed JD = birth_jd + years_elapsed (day-for-a-year)
            prog_jd = c.jd + years_elapsed
            # Progressed Moon position
            p_moon_vals, _ = swe.calc_ut(prog_jd, swe.MOON, SWE_FLAGS)
            p_moon_lon = p_moon_vals[0] % 360.0

            # Progressed Sun position
            p_sun_vals, _ = swe.calc_ut(prog_jd, swe.SUN, SWE_FLAGS)
            p_sun_lon = p_sun_vals[0] % 360.0

            hit = 0.0
            for p_body_lon in (p_moon_lon, p_sun_lon):
                for natal_angle in (c.asc_lon, c.mc_lon):
                    diff = angular_difference(p_body_lon, natal_angle)
                    for target in (0.0, 90.0, 120.0, 180.0):
                        dist = aspect_orb(diff, target)
                        if dist <= orb_max:
                            hit += math.exp(-(dist * dist) / two_orb_sq)
            log_likes.append(min(1.2, hit * 0.35))
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
        event_date_str = evidence_item.get("event_date") or evidence_item.get("date")
        if not event_date_str:
            return [0.0] * len(candidates)

        try:
            dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
            age = max(0, dt.year - birth_year)
        except Exception:
            return [0.0] * len(candidates)

        profection_offset = age % 12
        event_type = evidence_item.get("category", "career") # 'career', 'marriage', 'crisis'

        log_likes = []
        for c in candidates:
            asc_idx = SIGNS.index(c.asc_sign)
            profected_sign_idx = (asc_idx + profection_offset) % 12
            profected_house = (profected_sign_idx - asc_idx) % 12 + 1 # 1st to 12th house

            bonus = 0.0
            # Angular profections (1st, 10th, 7th, 4th) mark peak life events
            if profected_house in (1, 10, 7, 4):
                bonus += 0.4
            if event_type == "career" and profected_house == 10:
                bonus += 0.5
            elif event_type == "marriage" and profected_house == 7:
                bonus += 0.5
            elif event_type == "crisis" and profected_house in (6, 8, 12):
                bonus += 0.4
            log_likes.append(bonus)
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
        event_date_str = evidence_item.get("event_date") or evidence_item.get("date")
        if not event_date_str:
            return [0.0] * len(candidates)

        try:
            dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
            age = max(0.0, (dt.year - birth_year) + (dt.month - 1) / 12.0)
        except Exception:
            return [0.0] * len(candidates)

        direction_arc = age * 1.0  # Naibod key: 1 year ≈ 1° RA (approx 1° ecliptic)
        orb_max = 1.0
        two_orb_sq = 2.0 * (orb_max ** 2)

        log_likes = []
        for c in candidates:
            # Directed Ascendant and MC
            dir_asc = (c.asc_lon + direction_arc) % 360.0
            dir_mc = (c.mc_lon + direction_arc) % 360.0

            # Check if directed angle conjoins or opposes natal moon or natal sun
            score = 0.0
            for natal_body in (c.moon_lon,): # moon is fastest and most responsive
                for dir_ang in (dir_asc, dir_mc):
                    diff = angular_difference(dir_ang, natal_body)
                    for target in (0.0, 90.0, 180.0):
                        dist = aspect_orb(diff, target)
                        if dist <= orb_max:
                            score += math.exp(-(dist * dist) / two_orb_sq)
            log_likes.append(min(1.0, score * 0.3))
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

    for _ in range(num_samples):
        for ev in event_evidence:
            rand_year = rng.randint(birth_year + 18, birth_year + 65)
            rand_month = rng.randint(1, 12)
            rand_day = rng.randint(1, 28)
            fake_date = f"{rand_year:04d}-{rand_month:02d}-{rand_day:02d}T12:00:00Z"
            fake_ev = dict(ev)
            fake_ev["event_date"] = fake_date

            for scorer in event_scorers:
                scores = scorer.score(candidates, fake_ev, birth_year, lat, lon)
                for i, s in enumerate(scores):
                    null_log_sum[i] += s

    # Average background noise per candidate minute
    count = max(1, num_samples * len(event_evidence))
    return [val / count for val in null_log_sum]


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

    # Sunrise/Sunset calculation via swe
    cal_flag = swe.JUL_CAL if payload.calendar.lower() == "julian" else swe.GREG_CAL
    jd_noon = swe.julday(payload.year, payload.month, payload.day, 12.0 - payload.longitude / 15.0, cal_flag)
    
    rise_res = swe.rise_trans(jd_noon, swe.SUN, swe.CALC_RISE, (payload.longitude, payload.latitude, 0.0), 0.0, 0.0, swe.FLG_MOSEPH)
    set_res = swe.rise_trans(jd_noon, swe.SUN, swe.CALC_SET, (payload.longitude, payload.latitude, 0.0), 0.0, 0.0, swe.FLG_MOSEPH)

    sunrise_lmt = None
    sunset_lmt = None
    if rise_res[0] == 0:
        ut_h = (rise_res[1][0] - math.floor(rise_res[1][0]) - 0.5) * 24.0
        if ut_h < 0:
            ut_h += 24.0
        lmt_h = (ut_h + payload.longitude / 15.0) % 24.0
        sunrise_lmt = f"{int(lmt_h):02d}:{int((lmt_h % 1) * 60):02d}"
    if set_res[0] == 0:
        ut_h = (set_res[1][0] - math.floor(set_res[1][0]) - 0.5) * 24.0
        if ut_h < 0:
            ut_h += 24.0
        lmt_h = (ut_h + payload.longitude / 15.0) % 24.0
        sunset_lmt = f"{int(lmt_h):02d}:{int((lmt_h % 1) * 60):02d}"

    return WindowsResponse(
        rising_windows=windows,
        moon_start={"sign": m_first.moon_sign, "longitude": round(m_first.moon_lon, 2)},
        moon_end={"sign": m_last.moon_sign, "longitude": round(m_last.moon_lon, 2)},
        moon_ingress_minute=ingress_min,
        moon_ingress_time=ingress_str,
        sun_rise_lmt=sunrise_lmt,
        sun_set_lmt=sunset_lmt,
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
                # Apply null baseline discount
                discounted_log = []
                for i in range(n):
                    net = max(0.0, total_ev_log[i] - null_baseline[i])
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

    # Eligibility for calculations threshold
    is_eligible = (top_sign_prob >= 0.70 and window_80_mins <= 180)

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
    )


# --- Held-Out Benchmark Dataset for the 20 Timed Ground-Truth Agents ---

BENCHMARK_CASES = [
    {
        "id": "albert-einstein",
        "name": "Albert Einstein",
        "birth": {"year": 1879, "month": 3, "day": 14, "lat": 48.4011, "lon": 9.9876, "cal": "gregorian"},
        "ground_truth": {"time": "11:30", "sign": "Cancer", "asc": 101.65},
        "events": [
            {"type": "life_event", "description": "Annus Mirabilis papers submitted", "date": "1905-06-30"},
            {"type": "life_event", "description": "Awarded Nobel Prize in Physics", "date": "1921-11-09"},
        ],
    },
    {
        "id": "sigmund-freud",
        "name": "Sigmund Freud",
        "birth": {"year": 1856, "month": 5, "day": 6, "lat": 49.6116, "lon": 17.2381, "cal": "gregorian"},
        "ground_truth": {"time": "18:30", "sign": "Scorpio", "asc": 217.52},
        "events": [
            {"type": "life_event", "description": "Publication of The Interpretation of Dreams", "date": "1899-11-04"},
            {"type": "life_event", "description": "First major oral surgery for cancer", "date": "1923-04-01"},
        ],
    },
    {
        "id": "carl-jung",
        "name": "Carl Jung",
        "birth": {"year": 1875, "month": 7, "day": 26, "lat": 47.6, "lon": 9.3, "cal": "gregorian"},
        "ground_truth": {"time": "19:32", "sign": "Aquarius", "asc": 301.55},
        "events": [
            {"type": "life_event", "description": "Break with Freud and onset of Red Book visions", "date": "1913-10-27"},
            {"type": "life_event", "description": "Near death experience and heart attack", "date": "1944-02-14"},
        ],
    },
    {
        "id": "frida-kahlo",
        "name": "Frida Kahlo",
        "birth": {"year": 1907, "month": 7, "day": 6, "lat": 19.3, "lon": -99.2, "cal": "gregorian"},
        "ground_truth": {"time": "08:30", "sign": "Leo", "asc": 143.51},
        "events": [
            {"type": "life_event", "description": "Severe bus collision resulting in multiple fractures", "date": "1925-09-17"},
            {"type": "life_event", "description": "Marriage to Diego Rivera", "date": "1929-08-21"},
        ],
    },
    {
        "id": "vincent-van-gogh",
        "name": "Vincent van Gogh",
        "birth": {"year": 1853, "month": 3, "day": 30, "lat": 51.4408, "lon": 5.4798, "cal": "gregorian"},
        "ground_truth": {"time": "11:00", "sign": "Cancer", "asc": 111.13},
        "events": [
            {"type": "life_event", "description": "Ear severance incident in Arles", "date": "1888-12-23"},
            {"type": "life_event", "description": "Gunshot injury and death in Auvers", "date": "1890-07-29"},
        ],
    },
    {
        "id": "marie-curie",
        "name": "Marie Curie",
        "birth": {"year": 1867, "month": 11, "day": 7, "lat": 52.2297, "lon": 21.0122, "cal": "gregorian"},
        "ground_truth": {"time": "12:00", "sign": "Capricorn", "asc": 282.06},
        "events": [
            {"type": "life_event", "description": "Awarded Nobel Prize in Physics", "date": "1903-12-10"},
            {"type": "life_event", "description": "Pierre Curie killed in carriage accident", "date": "1906-04-19"},
            {"type": "life_event", "description": "Awarded second Nobel Prize in Chemistry", "date": "1911-12-10"},
        ],
    },
    {
        "id": "wolfgang-amadeus-mozart",
        "name": "Wolfgang Amadeus Mozart",
        "birth": {"year": 1756, "month": 1, "day": 27, "lat": 47.8095, "lon": 13.055, "cal": "gregorian"},
        "ground_truth": {"time": "20:00", "sign": "Virgo", "asc": 162.69},
        "events": [
            {"type": "life_event", "description": "Marriage to Constanze Weber in Vienna", "date": "1782-08-04"},
            {"type": "life_event", "description": "Premiere of Le Nozze di Figaro", "date": "1786-05-01"},
        ],
    },
    {
        "id": "johannes-kepler",
        "name": "Johannes Kepler",
        "birth": {"year": 1571, "month": 12, "day": 27, "lat": 48.8915, "lon": 8.7044, "cal": "julian"},
        "ground_truth": {"time": "14:37", "sign": "Gemini", "asc": 84.58},
        "events": [
            {"type": "life_event", "description": "Arrival at Tycho Brahe observatory at Benátky", "date": "1600-02-04"},
            {"type": "life_event", "description": "Publication of Astronomia Nova", "date": "1609-08-01"},
        ],
    },
    {
        "id": "galileo-galilei",
        "name": "Galileo Galilei",
        "birth": {"year": 1564, "month": 2, "day": 15, "lat": 43.7228, "lon": 10.4017, "cal": "julian"},
        "ground_truth": {"time": "15:31", "sign": "Leo", "asc": 131.95},
        "events": [
            {"type": "life_event", "description": "First telescopic observation of Jupiter moons", "date": "1610-01-07"},
            {"type": "life_event", "description": "Inquisition sentencing and house arrest in Rome", "date": "1633-06-22"},
        ],
    },
    {
        "id": "nikola-tesla",
        "name": "Nikola Tesla",
        "birth": {"year": 1856, "month": 7, "day": 10, "lat": 44.5167, "lon": 15.3, "cal": "gregorian"},
        "ground_truth": {"time": "00:00", "sign": "Taurus", "asc": 32.82},
        "events": [
            {"type": "life_event", "description": "Historic AIEE presentation of AC induction motor", "date": "1888-05-16"},
            {"type": "life_event", "description": "South 5th Ave laboratory destroyed by fire", "date": "1895-03-13"},
        ],
    },
    {
        "id": "charles-dickens",
        "name": "Charles Dickens",
        "birth": {"year": 1812, "month": 2, "day": 7, "lat": 50.8037, "lon": -1.0825, "cal": "gregorian"},
        "ground_truth": {"time": "19:50", "sign": "Virgo", "asc": 168.83},
        "events": [
            {"type": "life_event", "description": "Marriage to Catherine Hogarth; Pickwick begins", "date": "1836-04-02"},
            {"type": "life_event", "description": "Publication of A Christmas Carol", "date": "1843-12-19"},
        ],
    },
    {
        "id": "eleanor-roosevelt",
        "name": "Eleanor Roosevelt",
        "birth": {"year": 1884, "month": 10, "day": 11, "lat": 40.7128, "lon": -74.006, "cal": "gregorian"},
        "ground_truth": {"time": "11:00", "sign": "Sagittarius", "asc": 256.61},
        "events": [
            {"type": "life_event", "description": "Marriage to Franklin D. Roosevelt", "date": "1905-03-17"},
            {"type": "life_event", "description": "UN General Assembly adopts Universal Declaration of Human Rights", "date": "1948-12-10"},
        ],
    },
    {
        "id": "carl-sagan",
        "name": "Carl Sagan",
        "birth": {"year": 1934, "month": 11, "day": 9, "lat": 40.6782, "lon": -73.9442, "cal": "gregorian"},
        "ground_truth": {"time": "17:05", "sign": "Taurus", "asc": 55.36},
        "events": [
            {"type": "life_event", "description": "Launch of Voyager 2 carrying interstellar Golden Record", "date": "1977-08-20"},
            {"type": "life_event", "description": "Broadcast premiere of Cosmos on television", "date": "1980-09-28"},
        ],
    },
    {
        "id": "maya-angelou",
        "name": "Maya Angelou",
        "birth": {"year": 1928, "month": 4, "day": 4, "lat": 38.627, "lon": -90.1994, "cal": "gregorian"},
        "ground_truth": {"time": "14:10", "sign": "Leo", "asc": 143.97},
        "events": [
            {"type": "life_event", "description": "Publication of I Know Why the Caged Bird Sings", "date": "1969-10-01"},
            {"type": "life_event", "description": "Recitation of On the Pulse of Morning at Presidential Inauguration", "date": "1993-01-20"},
        ],
    },
    {
        "id": "immanuel-kant",
        "name": "Immanuel Kant",
        "birth": {"year": 1724, "month": 4, "day": 22, "lat": 54.7065, "lon": 20.5119, "cal": "gregorian"},
        "ground_truth": {"time": "05:00", "sign": "Taurus", "asc": 39.46},
        "events": [
            {"type": "life_event", "description": "Appointed Professor of Logic and Metaphysics at Königsberg", "date": "1770-08-21"},
            {"type": "life_event", "description": "Publication of Critique of Pure Reason", "date": "1781-05-01"},
        ],
    },
    {
        "id": "machiavelli",
        "name": "Niccolò Machiavelli",
        "birth": {"year": 1469, "month": 5, "day": 3, "lat": 43.7696, "lon": 11.2558, "cal": "julian"},
        "ground_truth": {"time": "23:07", "sign": "Capricorn", "asc": 282.38},
        "events": [
            {"type": "life_event", "description": "Appointed Second Chancellor of the Republic of Florence", "date": "1498-06-19"},
            {"type": "life_event", "description": "Letter to Vettori announcing completion of The Prince", "date": "1513-12-10"},
        ],
    },
    {
        "id": "michelangelo",
        "name": "Michelangelo Buonarroti",
        "birth": {"year": 1475, "month": 3, "day": 6, "lat": 43.6414, "lon": 11.9847, "cal": "julian"},
        "ground_truth": {"time": "01:45", "sign": "Sagittarius", "asc": 264.50},
        "events": [
            {"type": "life_event", "description": "Public unveiling of the colossal David statue in Florence", "date": "1504-09-08"},
            {"type": "life_event", "description": "Inauguration and public viewing of the Sistine Chapel ceiling", "date": "1512-10-31"},
        ],
    },
    {
        "id": "isaac-asimov",
        "name": "Isaac Asimov",
        "birth": {"year": 1920, "month": 1, "day": 2, "lat": 53.9753, "lon": 32.1583, "cal": "gregorian"},
        "ground_truth": {"time": "15:35", "sign": "Cancer", "asc": 99.69},
        "events": [
            {"type": "life_event", "description": "Publication of Nightfall in Astounding Science Fiction", "date": "1941-09-01"},
            {"type": "life_event", "description": "Publication of Foundation as fix-up novel", "date": "1951-05-01"},
        ],
    },
    {
        "id": "paulo-freire",
        "name": "Paulo Freire",
        "birth": {"year": 1921, "month": 9, "day": 19, "lat": -8.0476, "lon": -34.877, "cal": "gregorian"},
        "ground_truth": {"time": "15:45", "sign": "Aquarius", "asc": 323.98},
        "events": [
            {"type": "life_event", "description": "Arrest and imprisonment following Brazilian military coup", "date": "1964-06-01"},
            {"type": "life_event", "description": "Completion of Pedagogy of the Oppressed manuscript in Chile", "date": "1968-12-01"},
        ],
    },
    {
        "id": "wangari-maathai",
        "name": "Wangari Maathai",
        "birth": {"year": 1940, "month": 4, "day": 1, "lat": -0.4201, "lon": 36.9476, "cal": "gregorian"},
        "ground_truth": {"time": "14:30", "sign": "Leo", "asc": 134.61},
        "events": [
            {"type": "life_event", "description": "Founding of the Green Belt Movement on World Environment Day", "date": "1977-06-05"},
            {"type": "life_event", "description": "Awarded the Nobel Peace Prize in Oslo", "date": "2004-10-08"},
        ],
    },
]


@router.get("/benchmark")
def get_rectification_benchmark(step_minutes: int = 10):
    """Executes a blind back-test across the 20 held-out measured charts, hiding the known birth time,

    scoring only against dated biographical events, and reporting top-1 and top-3 hit rates.
    """
    results = []
    top_1_hits = 0
    top_3_hits = 0
    total_angular_error = 0.0

    for case in BENCHMARK_CASES:
        req = RectificationScoreRequest(
            year=case["birth"]["year"],
            month=case["birth"]["month"],
            day=case["birth"]["day"],
            latitude=case["birth"]["lat"],
            longitude=case["birth"]["lon"],
            calendar=case["birth"]["cal"],
            evidence=case["events"],
            step_minutes=step_minutes,
        )

        res = post_rectify_score(req)

        # Rank signs
        sorted_signs = sorted(res.distribution.keys(), key=lambda s: res.distribution[s], reverse=True)
        top_1 = sorted_signs[0]
        top_3 = sorted_signs[:3]

        true_sign = case["ground_truth"]["sign"]
        true_asc = case["ground_truth"]["asc"]

        is_top_1 = (top_1 == true_sign)
        is_top_3 = (true_sign in top_3)

        if is_top_1:
            top_1_hits += 1
        if is_top_3:
            top_3_hits += 1

        # Angular error in degrees [0, 180]
        diff = abs(((res.working_longitude - true_asc + 180.0) % 360.0) - 180.0)
        total_angular_error += diff

        results.append({
            "id": case["id"],
            "name": case["name"],
            "true_time": case["ground_truth"]["time"],
            "true_sign": true_sign,
            "true_asc": true_asc,
            "predicted_time": res.working_time,
            "predicted_sign": top_1,
            "predicted_asc": res.working_longitude,
            "top_sign_probability": res.top_sign_probability,
            "top_1_hit": is_top_1,
            "top_3_hit": is_top_3,
            "top_3_signs": top_3,
            "angular_error_deg": round(diff, 2),
            "certainty": res.certainty,
            "window_80_minutes": res.window_80_minutes,
        })

    total_cases = len(BENCHMARK_CASES)
    return {
        "benchmark_summary": {
            "total_cases": total_cases,
            "top_1_hits": top_1_hits,
            "top_1_accuracy": round(top_1_hits / total_cases, 4),
            "top_3_hits": top_3_hits,
            "top_3_accuracy": round(top_3_hits / total_cases, 4),
            "mean_angular_error_deg": round(total_angular_error / total_cases, 2),
            "step_minutes_evaluated": step_minutes,
        },
        "results": results,
    }
