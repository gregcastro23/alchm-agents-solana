"""
Contract and regression tests for Fourteen Alchemical Pillars duel engine
and the companion endpoint:

    POST /api/agents/pillar

Validates:
  1. Full parity with spec/pillars.v1.json and alchm-astro-core golden fixtures.
  2. Parity with TypeScript lib/pillar-agent-duel.ts and app/api/agents/pillar/route.ts.
  3. Strict input bounds and HTTP error contracts on FastAPI.
"""

import json
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")

import main  # noqa: E402
import pillar_brain  # noqa: E402

client = TestClient(main.app)

ALL_PLANETS = [
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
]


class TestPillarBrainCore:
    def test_spec_loading(self):
        assert pillar_brain.SPEC["version"] == "1.0.0"
        assert len(pillar_brain.PILLARS) == 14
        assert len(set(p["id"] for p in pillar_brain.PILLARS)) == 14
        for p in pillar_brain.PILLARS:
            assert all(e in (-1, 1) for e in p["effects"])
            assert p["id"] in range(1, 15)

    def test_all_10_planetary_archetypes(self):
        signatures = set()
        for p in ALL_PLANETS:
            assert pillar_brain.is_planetary_agent(p) is True
            chart = pillar_brain.AGENT_ARCHETYPE_CHARTS[p]
            assert len(chart["signs"]) == 10
            assert chart["timeKnown"] is True
            signatures.add(tuple(chart["signs"]))
        assert len(signatures) == 10

        assert pillar_brain.is_planetary_agent("Earth") is False
        assert pillar_brain.is_planetary_agent("Chiron") is False

    def test_hands_in_both_skies(self):
        for p in ALL_PLANETS:
            d_hand = pillar_brain.get_agent_legal_hand(p, "diurnal")
            n_hand = pillar_brain.get_agent_legal_hand(p, "nocturnal")

            assert len(d_hand) >= 2
            assert len(n_hand) >= 2

            for pillar in d_hand:
                assert pillar["sect"] in ("diurnal", "both")
            for pillar in n_hand:
                assert pillar["sect"] in ("nocturnal", "both")

    def test_answer_pillar_duel_all_planets(self):
        mars_chart = pillar_brain.AGENT_ARCHETYPE_CHARTS["Mars"]
        for agent in ALL_PLANETS:
            ans = pillar_brain.answer_pillar_duel(
                agent_planet=agent,
                opening_pillar_id=7,  # Calcination
                challenger_chart=mars_chart,
                challenger_pools=pillar_brain.DEFAULT_AGENT_POOLS,
                sky="diurnal",
            )
            assert 1 <= ans["chosenPillar"]["id"] <= 14
            assert ans["chosenPillar"]["sect"] in ("diurnal", "both")
            assert len(ans["voice"]) > 10
            assert ans["chosenPillar"]["name"] in ans["voice"]
            assert isinstance(ans["willWin"], bool)
            assert ans["outcome"]["winner"] in ("a", "b", "draw")
            assert isinstance(ans["outcome"]["ratioA"], float)
            assert isinstance(ans["outcome"]["ratioB"], float)

    def test_golden_spec_fixtures_parity(self):
        fixture_path = _BACKEND_DIR.parent / "alchm-astro-core" / "spec" / "fixtures" / "cast-power.v1.json"
        if not fixture_path.exists():
            pytest.skip("cast-power.v1.json fixture not available")

        with open(fixture_path, encoding="utf-8") as f:
            fixtures = json.load(f)

        tol = fixtures["tolerance"]
        charts = {c["id"]: c for c in fixtures["charts"]}

        # 1. State assertions
        for st in fixtures["states"]:
            c = charts[st["chart"]]
            p = st["pools"]
            got = pillar_brain.circuit_state(c, p)
            exp = st["expected"]
            for k in [
                "heat",
                "entropy",
                "reactivity",
                "energy",
                "charge",
                "current",
                "voltage",
                "power",
                "potency",
                "magnitude",
            ]:
                scale = max(1.0, abs(got[k]), abs(exp[k]))
                assert abs(got[k] - exp[k]) <= tol * scale, f"{k}: got {got[k]}, want {exp[k]}"
            assert pillar_brain.hand(c, "diurnal") == exp["handDiurnal"]
            assert pillar_brain.hand(c, "nocturnal") == exp["handNocturnal"]

        # 2. Duel assertions
        for d in fixtures["duels"]:
            ca = charts[d["a"]["chart"]]
            cb = charts[d["b"]["chart"]]
            outcome = pillar_brain.resolve_duel(
                ca, d["a"]["pools"], d["a"]["pillar"], cb, d["b"]["pools"], d["b"]["pillar"]
            )
            exp = d["expected"]
            assert outcome["winner"] == exp["winner"]
            for k in ["ratioA", "ratioB", "magnitudeA", "magnitudeB"]:
                scale = max(1.0, abs(outcome[k]), abs(exp[k]))
                assert abs(outcome[k] - exp[k]) <= tol * scale, f"{k}: got {outcome[k]}, want {exp[k]}"


class TestPillarEndpointHTTP:
    def test_successful_pillar_move_by_name(self):
        res = client.post(
            "/api/agents/pillar",
            json={
                "planet": "Sun",
                "opening": "Calcination",
                "sky": "diurnal",
                "source": "pentacles-feeder",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["planet"] == "Sun"
        assert body["pillar"] == "Evaporation"
        assert body["pillarId"] == 3
        assert "Evaporation" in body["voice"]
        assert body["source"] == "best-response"
        assert isinstance(body["willWin"], bool)
        assert body["winner"] in ("a", "b", "draw")
        assert isinstance(body["powerRatio"], float)
        assert isinstance(body["magnitude"], float)
        assert body["timestamp"].endswith("Z")

    def test_successful_pillar_move_by_id(self):
        res = client.post(
            "/api/agents/pillar",
            json={
                "planet": "Mars",
                "opening": 7,
                "sky": "nocturnal",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["planet"] == "Mars"
        assert isinstance(body["pillar"], str)
        assert isinstance(body["pillarId"], int)

    def test_invalid_planet_error(self):
        res = client.post(
            "/api/agents/pillar",
            json={
                "planet": "Earth",
                "opening": "Calcination",
            },
        )
        assert res.status_code == 400
        body = res.json()
        assert body["success"] is False
        assert "ten planetary spheres" in body["error"]

    def test_invalid_opening_error(self):
        res = client.post(
            "/api/agents/pillar",
            json={
                "planet": "Sun",
                "opening": "NonexistentPillar",
            },
        )
        assert res.status_code == 400
        body = res.json()
        assert body["success"] is False
        assert "Fourteen Alchemical Pillars" in body["error"]

    def test_custom_challenger_chart_and_pools(self):
        custom_chart = {
            "signs": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            "ascendantSign": 0,
            "timeKnown": True,
        }
        custom_pools = [90.0, 70.0, 85.0, 95.0]

        res = client.post(
            "/api/agents/pillar",
            json={
                "planet": "Jupiter",
                "opening": 1,
                "sky": "diurnal",
                "challengerChart": custom_chart,
                "challengerPools": custom_pools,
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["planet"] == "Jupiter"
        assert body["winner"] in ("a", "b", "draw")
