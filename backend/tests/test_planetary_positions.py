"""Regression tests for the planetary-position endpoints.

On 2026-10-15 05:43 UTC ``GET /planetary/current`` reported the Sun at 11°07′
Aquarius (exactLongitude 311.11). The real Sun stood at 21°53′ Libra (201.89°).
The cause was ``_planetary_positions_for``: a circular-orbit model whose
per-planet phase offsets were arbitrary numbers rather than J2000 mean
longitudes, so every body was wrong by tens of degrees (Mercury by up to 162°)
and nothing ever retrograded. The Pentacles Oracle injects this block into every
question's context.

The endpoints now use Swiss Ephemeris. The expected values below come from an
INDEPENDENT ephemeris (PyEphem: VSOP87 / ELP2000), recorded in
``fixtures/ephemeris_reference.json`` — not from the code under test — so a
future change that quietly swaps the engine back for an approximation fails here.
"""

import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")

import main  # noqa: E402

client = TestClient(main.app)

REFERENCE = json.loads((Path(__file__).parent / "fixtures" / "ephemeris_reference.json").read_text(encoding="utf-8"))
BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

# Measured agreement between Swiss Ephemeris (Moshier) and the reference is <= 0.0025°.
# The tolerance leaves room for a different libswe patch release without letting a
# wrong engine through: the circular model was off by 33° – 172° at these instants.
TOLERANCE_DEG = 0.02

BUG_INSTANT = "2026-10-15T05:43:00"


def circular_delta(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def positions_at(iso_utc: str) -> dict:
    response = client.post("/api/planetary/positions", json={"date": iso_utc + "Z"})
    assert response.status_code == 200, response.text
    return response.json()["planetary_positions"]


class _FrozenClock(datetime):
    """datetime whose utcnow() is pinned — the GET endpoint reads the clock itself."""

    frozen = datetime(2026, 10, 15, 5, 43, 0)

    @classmethod
    def utcnow(cls):
        return cls.frozen


# ---------------------------------------------------------------------------
# The reported bug
# ---------------------------------------------------------------------------


def test_planetary_current_puts_the_sun_in_libra_on_the_day_it_reported_aquarius(monkeypatch):
    monkeypatch.setattr(main, "datetime", _FrozenClock)

    response = client.get("/planetary/current")

    assert response.status_code == 200
    body = response.json()
    sun = body["planetary_positions"]["Sun"]
    assert body["birth_info"] == {"year": 2026, "month": 10, "date": 15, "hour": 5, "minute": 43}
    assert sun["sign"] == "Libra"
    assert (sun["degree"], sun["minute"]) == (21, 53)
    assert 201.85 < sun["exactLongitude"] < 201.95  # not 311.11
    assert body["source"] == "swiss-ephemeris"


def test_the_oracles_live_sky_line_reads_sensibly(monkeypatch):
    """Rebuild the exact string the Pentacles feeder derives from this endpoint."""
    monkeypatch.setattr(main, "datetime", _FrozenClock)
    positions = client.get("/planetary/current").json()["planetary_positions"]

    parts = [
        f"{name} {int(p['degree'])}°{p['sign']}{' Rx' if p['isRetrograde'] else ''}"
        for name, p in positions.items()
    ]

    assert parts[0] == "Sun 21°Libra"
    assert "Venus 5°Scorpio Rx" in parts  # Venus was retrograde in Oct 2026
    assert any(part.startswith("Saturn ") and part.endswith(" Rx") for part in parts)


# ---------------------------------------------------------------------------
# Accuracy against the independent reference
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("instant", [i["utc"] for i in REFERENCE["instants"]])
def test_every_body_matches_the_independent_ephemeris(instant):
    expected = next(i for i in REFERENCE["instants"] if i["utc"] == instant)["bodies"]
    positions = positions_at(instant)

    assert list(positions) == BODIES
    for body in BODIES:
        got = positions[body]
        assert circular_delta(got["exactLongitude"], expected[body]["longitude"]) < TOLERANCE_DEG, (instant, body)
        if not expected[body].get("retro_boundary"):  # a planet at its station: either flag is defensible
            assert got["isRetrograde"] is expected[body]["retrograde"], (instant, body)
        assert got["sign"] == SIGNS[int(expected[body]["longitude"] // 30)] or circular_delta(
            got["exactLongitude"], round(expected[body]["longitude"] / 30) * 30
        ) < TOLERANCE_DEG, (instant, body)  # a sign differs only if the body sits on a cusp


def test_retrograde_flag_agrees_with_the_sign_of_the_speed():
    positions = positions_at(BUG_INSTANT)

    for body in BODIES:
        position = positions[body]
        assert position["isRetrograde"] == (position["longitudeSpeed"] < 0), body
        assert position["retrogradeSymbol"] == ("℞" if position["isRetrograde"] else ""), body
    assert not positions["Sun"]["isRetrograde"] and not positions["Moon"]["isRetrograde"]
    assert 11.5 < positions["Moon"]["longitudeSpeed"] < 15.5  # deg/day, the Moon is the fast one


def test_response_shape_is_the_one_the_nextjs_client_reads():
    """lib/backend.ts PlanetaryBody: unchanged fields, plus a provenance stamp."""
    body = client.post("/api/planetary/positions", json={"date": BUG_INSTANT + "Z"}).json()

    assert body["birth_info"] == {"year": 2026, "month": 10, "date": 15, "hour": 5, "minute": 43}
    assert body["source"] == "swiss-ephemeris"
    for body_name, position in body["planetary_positions"].items():
        assert set(position) == {
            "sign", "degree", "minute", "exactLongitude", "isRetrograde", "retrogradeSymbol",
            "longitudeSpeed", "arcminutesPerDay", "speedDisplay", "source",
        }, body_name  # fmt: skip
        assert position["source"] == "swiss-ephemeris"
        assert 0 <= position["degree"] < 30 and 0 <= position["minute"] < 60
        assert 0 <= position["exactLongitude"] < 360
        assert position["sign"] == SIGNS[int(position["exactLongitude"] // 30)]
        assert position["degree"] == int(position["exactLongitude"] % 30)


# ---------------------------------------------------------------------------
# Physics that needs no reference ephemeris (mirrors chart-engine-physical-bounds.spec.ts)
# ---------------------------------------------------------------------------


def test_inner_planet_elongations_stay_inside_their_physical_ceilings():
    """Mercury never strays more than 28° from the Sun, Venus 48°. The old model reached 180°."""
    start = datetime(2024, 1, 1)
    worst = {"Mercury": 0.0, "Venus": 0.0}
    for step in range(0, 4000, 7):
        positions = main._planetary_positions_for(start + timedelta(days=step))
        for body in worst:
            worst[body] = max(worst[body], circular_delta(positions[body]["exactLongitude"], positions["Sun"]["exactLongitude"]))

    assert 20 < worst["Mercury"] < 28.5
    assert 40 < worst["Venus"] < 48.5


def test_the_sun_advances_about_a_degree_a_day_and_the_year_closes():
    day0 = main._planetary_positions_for(datetime(2026, 3, 1))["Sun"]["exactLongitude"]
    day1 = main._planetary_positions_for(datetime(2026, 3, 2))["Sun"]["exactLongitude"]
    year = main._planetary_positions_for(datetime(2027, 3, 1))["Sun"]["exactLongitude"]

    assert 0.9 < (day1 - day0) % 360 < 1.05
    assert circular_delta(year, day0) < 0.5  # one tropical year later, back to the same place


# ---------------------------------------------------------------------------
# Time handling
# ---------------------------------------------------------------------------


def test_utc_offsets_are_converted_not_discarded():
    """'…T10:43:00+05:00' is 05:43 UTC. It used to be read as 10:43 UTC."""
    z = positions_at("2026-10-15T05:43:00")
    offset = client.post("/api/planetary/positions", json={"date": "2026-10-15T10:43:00+05:00"}).json()
    negative = client.post("/api/planetary/positions", json={"date": "2026-10-15T00:43:00-05:00"}).json()

    assert offset["birth_info"] == negative["birth_info"] == {"year": 2026, "month": 10, "date": 15, "hour": 5, "minute": 43}
    assert offset["planetary_positions"] == negative["planetary_positions"] == z


def test_component_payloads_still_work():
    by_parts = client.post(
        "/api/planetary/positions",
        json={"year": 2026, "month": 10, "day": 15, "hour": 5, "minute": 43, "latitude": 40.7, "longitude": -74.0},
    ).json()

    assert by_parts["planetary_positions"] == positions_at(BUG_INSTANT)


def test_dates_outside_the_ephemeris_span_are_a_client_error_not_a_crash():
    response = client.post("/api/planetary/positions", json={"date": "5000-01-01T00:00:00Z"})

    assert response.status_code == 422
    assert "supported ephemeris range" in response.json()["detail"]


def test_ancient_dates_inside_the_span_work():
    """Cleopatra's era: the Julian-day maths must not remap years 0–99 to 19xx."""
    positions = positions_at("0069-01-01T12:00:00")

    assert circular_delta(positions["Sun"]["exactLongitude"], 280.0) < 25  # early January: Capricorn


# ---------------------------------------------------------------------------
# bulk
# ---------------------------------------------------------------------------


def test_bulk_positions_are_real_and_labelled():
    response = client.post(
        "/api/planetary/positions/bulk",
        json={"startDate": "2026-10-15T00:00:00", "endDate": "2026-10-16T00:00:00", "intervalHours": 24},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2 and body["degraded"] is False and body["source"] == "swiss-ephemeris"
    first, second = (s["positions"]["planetary_positions"]["Sun"]["exactLongitude"] for s in body["samples"])
    assert 0.9 < (second - first) % 360 < 1.05
    assert 201 < first < 202


# ---------------------------------------------------------------------------
# A fallback must not impersonate the real thing
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/planetary/current", None),
        ("post", "/api/planetary/positions", {"date": "2026-10-15T05:43:00Z"}),
        ("post", "/api/planetary/positions/bulk", {"startDate": "2026-10-15T00:00:00", "endDate": "2026-10-15T06:00:00", "intervalHours": 6}),
        ("get", "/api/philosophers-stone/positions", None),
    ],
)
def test_without_swiss_ephemeris_the_endpoints_answer_503_never_invented_positions(monkeypatch, method, path, body):
    monkeypatch.setattr(main, "ephemeris_service", None)

    response = client.request(method, path, json=body)

    assert response.status_code == 503
    assert response.json()["error"] == "ephemeris_unavailable"
    assert "planetary_positions" not in response.json()


def test_a_body_swiss_ephemeris_cannot_compute_is_a_503_not_a_partial_chart(monkeypatch):
    real = main.ephemeris_service.calculate_single_planet

    def flaky(planet_id, jd):
        if planet_id == main.ephemeris_service.PLANETS["pluto"]:
            raise RuntimeError("no ephemeris for Pluto")
        return real(planet_id, jd)

    monkeypatch.setattr(main.ephemeris_service, "calculate_single_planet", flaky)

    response = client.get("/planetary/current")

    assert response.status_code == 503
    assert "Pluto" in response.json()["message"]


@pytest.mark.parametrize(
    "longitude,sign,degree,minute,exact",
    [
        (359.99996, "Aries", 0, 0, 0.0),  # rounds to 360 -> 0, never "Pisces 29°59′ / 0.0"
        (29.99996, "Taurus", 0, 0, 30.0),  # rounds to 30 -> next sign
        (359.99994, "Pisces", 29, 59, 359.9999),
        (0.0, "Aries", 0, 0, 0.0),
        (201.893, "Libra", 21, 53, 201.893),
        (-0.00002, "Aries", 0, 0, 0.0),  # swisseph never returns it, but the maths must hold
    ],
)
def test_sign_degree_minute_and_exact_longitude_always_agree(monkeypatch, longitude, sign, degree, minute, exact):
    real = main.ephemeris_service.calculate_single_planet
    monkeypatch.setattr(
        main.ephemeris_service,
        "calculate_single_planet",
        lambda pid, jd: {**real(pid, jd), "longitude": longitude, "speed": 0.5},
    )

    sun = main._planetary_positions_for(datetime(2026, 10, 15))["Sun"]

    assert (sun["sign"], sun["degree"], sun["minute"], sun["exactLongitude"]) == (sign, degree, minute, exact)


# P17/P18/P19: no fixture instant has non-zero seconds or microseconds, so those JD terms were unpinned.
def test_seconds_and_microseconds_move_the_moon_by_the_right_amount():
    base = main._planetary_positions_for(datetime(2026, 10, 15, 5, 43, 0))["Moon"]
    plus59 = main._planetary_positions_for(datetime(2026, 10, 15, 5, 43, 59))["Moon"]
    expected = base["longitudeSpeed"] * 59 / 86400  # about 0.009 degrees
    assert abs(circular_delta(plus59["exactLongitude"], base["exactLongitude"]) - expected) < 0.0005
    micro = main._planetary_positions_for(datetime(2026, 10, 15, 5, 43, 0, 999999))["Moon"]
    assert circular_delta(micro["exactLongitude"], base["exactLongitude"]) < 0.0003  # under one second of motion


# P22: the old test only looked at the Sun on 1 January, which is the same in 0069 and 1969.
def test_year_69_is_computed_for_year_69_not_1969():
    import swisseph as swe

    jd = date(69, 1, 1).toordinal() + 1721424.5 + 0.5  # proleptic Gregorian, noon UT, independent of the code under test
    moon, _flag = swe.calc_ut(jd, swe.MOON, swe.FLG_MOSEPH)
    mars, _flag = swe.calc_ut(jd, swe.MARS, swe.FLG_MOSEPH)
    got = positions_at("0069-01-01T12:00:00")
    assert circular_delta(got["Moon"]["exactLongitude"], moon[0]) < 0.05
    assert circular_delta(got["Mars"]["exactLongitude"], mars[0]) < 0.05


# P10: naive timestamps are UTC, whatever zone the server runs in.
def test_naive_timestamps_are_read_as_utc_whatever_the_machine_timezone(monkeypatch):
    zone = os.environ.get("TZ")
    monkeypatch.setenv("TZ", "Pacific/Auckland")
    time.tzset()
    try:
        naive = client.post("/api/planetary/positions", json={"date": "2026-10-15T05:43:00"}).json()
        zulu = client.post("/api/planetary/positions", json={"date": "2026-10-15T05:43:00Z"}).json()
    finally:
        monkeypatch.undo()
        if zone is None:
            os.environ.pop("TZ", None)
        time.tzset()
    assert naive["birth_info"] == zulu["birth_info"] and naive["planetary_positions"] == zulu["planetary_positions"]


# NEW (source defect): /api/planetary/positions/bulk discards the UTC offset the single endpoint converts.
def test_bulk_converts_utc_offsets_like_the_single_endpoint():
    def moon(start):
        r = client.post("/api/planetary/positions/bulk", json={"startDate": start, "endDate": start, "intervalHours": 1})
        assert r.status_code == 200
        return r.json()["samples"][0]["positions"]["planetary_positions"]["Moon"]["exactLongitude"]

    assert circular_delta(moon("2026-10-15T10:43:00+05:00"), moon("2026-10-15T05:43:00Z")) < 0.001


# P26/P27: the bulk endpoint is capped and its step is floored (each sample is ten ephemeris calls).
def test_bulk_is_capped_at_500_samples_and_the_step_is_at_least_a_quarter_hour():
    capped = client.post(
        "/api/planetary/positions/bulk",
        json={"startDate": "2026-01-01T00:00:00", "endDate": "2026-12-31T00:00:00", "intervalHours": 0.25},
    ).json()
    floored = client.post(
        "/api/planetary/positions/bulk",
        json={"startDate": "2026-10-15T00:00:00", "endDate": "2026-10-15T01:00:00", "intervalHours": 0.01},
    ).json()
    assert capped["count"] == 500
    assert floored["count"] == 5  # 00:00, 00:15, 00:30, 00:45, 01:00


# P24/P25: the derived speed fields carry the unit the Next.js client displays.
def test_derived_speed_fields_are_consistent_with_longitude_speed():
    for name, p in positions_at("2026-10-15T05:43:00").items():
        assert p["arcminutesPerDay"] == pytest.approx(p["longitudeSpeed"] * 60, abs=1e-3), name
        assert p["speedDisplay"] == f"{round(p['longitudeSpeed'], 3)}°/day", name
