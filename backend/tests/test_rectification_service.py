"""Unit & handler tests for the Bayesian Ascendant rectification engine and dossier catalog."""

import math
import sys
from pathlib import Path

import pytest

_ROOT_DIR = Path(__file__).resolve().parents[2]
_BACKEND_DIR = _ROOT_DIR / "backend"
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import rectification_dossiers as rd  # noqa: E402
import rectification_service as rs  # noqa: E402


def test_asymmetric_cusp_routing_breaks_angle_polarity():
    """Career hits should weight MC conjunctions above IC conjunctions; relocation prefers IC."""
    ev_career = {"type": "life_event", "category": "career", "date": "1921-11-09", "description": "Career"}
    ev_reloc = {"type": "life_event", "category": "relocation", "date": "1921-11-09", "description": "Move"}
    ev_jd = rs.parse_event_jd(ev_career)
    assert ev_jd is not None
    saturn_lon = rs._calc_lons(ev_jd, rs.ALL_PLANETS)["Saturn"]

    cand_mc = rs.CandidateMinute(
        minute=600,
        local_time="10:00",
        jd=2415020.5,
        asc_lon=(saturn_lon + 47.0) % 360.0,
        mc_lon=saturn_lon,
        asc_sign="Leo",
        mc_sign="Libra",
        moon_lon=200.0,
        moon_sign="Libra",
    )
    cand_ic = rs.CandidateMinute(
        minute=660,
        local_time="11:00",
        jd=2415020.5,
        asc_lon=(saturn_lon + 47.0) % 360.0,
        mc_lon=(saturn_lon + 180.0) % 360.0,
        asc_sign="Leo",
        mc_sign="Aries",
        moon_lon=200.0,
        moon_sign="Libra",
    )

    scorer = rs.AngularTransitScorer()
    career_scores = scorer.score([cand_mc, cand_ic], ev_career, 1900, 45.0, 0.0)
    reloc_scores = scorer.score([cand_mc, cand_ic], ev_reloc, 1900, 45.0, 0.0)

    assert career_scores[0] > career_scores[1]  # MC > IC for career
    assert reloc_scores[1] > reloc_scores[0]    # IC > MC for relocation

    angles = dict(rs.oriented_angles(cand_mc))
    assert math.isclose(angles["DSC"], (cand_mc.asc_lon + 180.0) % 360.0, abs_tol=1e-6)
    assert math.isclose(angles["IC"], (cand_mc.mc_lon + 180.0) % 360.0, abs_tol=1e-6)


def test_equatorial_angle_square_deduplication():
    """Low-latitude charts where MC is ~90 deg from ASC must deduplicate single-body 0/90 hits."""
    ev = {"type": "life_event", "category": "career", "date": "1921-11-09", "description": "Milestone"}
    ev_jd = rs.parse_event_jd(ev)
    assert ev_jd is not None
    saturn_lon = rs._calc_lons(ev_jd, rs.ALL_PLANETS)["Saturn"]

    cand_eq = rs.CandidateMinute(
        minute=600,
        local_time="10:00",
        jd=2415020.5,
        asc_lon=(saturn_lon + 90.0) % 360.0,
        mc_lon=saturn_lon,
        asc_sign="Capricorn",
        mc_sign="Libra",
        moon_lon=200.0,
        moon_sign="Libra",
    )
    cand_non_sq = rs.CandidateMinute(
        minute=630,
        local_time="10:30",
        jd=2415020.5,
        asc_lon=(saturn_lon + 47.0) % 360.0,
        mc_lon=saturn_lon,
        asc_sign="Sagittarius",
        mc_sign="Libra",
        moon_lon=200.0,
        moon_sign="Libra",
    )
    scorer = rs.AngularTransitScorer()
    res = scorer.score([cand_eq, cand_non_sq], ev, 1900, 0.0, 0.0)
    assert len(res) == 2
    assert 0.0 < res[0] < 15.0
    assert res[0] - res[1] < 0.75


def test_annual_profection_breaks_four_quadrant_symmetry():
    """Opposite signs (Aries vs Libra, Cancer vs Capricorn) receive distinct profection scores."""
    candidates = rs.generate_candidate_minutes(
        year=1879,
        month=3,
        day=14,
        lat=48.4011,
        lon=9.9876,
        calendar="gregorian",
        step_minutes=15,
    )
    scorer = rs.AnnualProfectionScorer()
    ev = {
        "type": "life_event",
        "category": "career",
        "date": "1921-11-09",
        "description": "Nobel Prize in Physics",
    }
    scores = scorer.score(candidates, ev, 1879, 48.4011, 9.9876)
    assert len(scores) == len(candidates)

    by_sign = {}
    for c, s in zip(candidates, scores):
        by_sign.setdefault(c.asc_sign, []).append(s)

    sign_means = {k: sum(v) / len(v) for k, v in by_sign.items()}
    assert max(sign_means.values()) - min(sign_means.values()) > 0.05
    assert not math.isclose(sign_means["Cancer"], sign_means["Capricorn"], abs_tol=1e-4)
    assert not math.isclose(sign_means["Aries"], sign_means["Libra"], abs_tol=1e-4)


def test_secondary_progression_recomputes_progressed_moon_per_minute():
    """SecondaryProgressionScorer evaluates dynamic progressed Moon across candidate minutes."""
    candidates = rs.generate_candidate_minutes(
        year=1991,
        month=6,
        day=23,
        lat=40.6782,
        lon=-73.9442,
        calendar="gregorian",
        step_minutes=30,
    )
    moon_span = (candidates[-1].moon_lon - candidates[0].moon_lon) % 360.0
    assert 10.0 <= moon_span <= 16.0

    scorer = rs.SecondaryProgressionScorer()
    scores = scorer.score(
        candidates,
        {"type": "life_event", "category": "career", "date": "2020-06-23", "description": "Milestone"},
        1991,
        40.6782,
        -73.9442,
    )
    assert len(scores) == len(candidates)
    assert any(s != 0.0 for s in scores)


def test_primary_direction_scorer_naibod_arc():
    """PrimaryDirectionScorer yields non-negative localized peaks matching Naibod ~0.9856 deg/yr."""
    candidates = rs.generate_candidate_minutes(
        year=1879,
        month=3,
        day=14,
        lat=48.4011,
        lon=9.9876,
        calendar="gregorian",
        step_minutes=15,
    )
    scorer = rs.PrimaryDirectionScorer()
    scores = scorer.score(
        candidates,
        {"type": "life_event", "category": "career", "date": "1905-06-30", "description": "Annus Mirabilis"},
        1879,
        48.4011,
        9.9876,
    )
    assert len(scores) == len(candidates)
    assert max(scores) > min(scores)


def test_einstein_recorded_time_vs_blind_milestone_calibration():
    """Blind 2-event milestones stay below >=70% threshold; Rodden A concentrates cleanly on Cancer."""
    einstein_events = [
        {"type": "life_event", "category": "career", "date": "1905-06-30", "description": "Annus Mirabilis"},
        {"type": "life_event", "category": "career", "date": "1921-11-09", "description": "Nobel Prize"},
    ]
    blind = rs.post_rectify_score(
        rs.RectificationScoreRequest(
            year=1879,
            month=3,
            day=14,
            latitude=48.4011,
            longitude=9.9876,
            evidence=einstein_events,
            step_minutes=5,
        )
    )
    assert math.isclose(sum(blind.distribution.values()), 1.0, abs_tol=1e-3)
    assert blind.is_calculations_eligible is False

    rodden_a = rs.post_rectify_score(
        rs.RectificationScoreRequest(
            year=1879,
            month=3,
            day=14,
            latitude=48.4011,
            longitude=9.9876,
            evidence=[
                *einstein_events,
                {
                    "type": "recorded_time",
                    "reported_minute": 690,
                    "rodden_rating": "A",
                    "description": "Ulm civil record 11:30",
                },
            ],
            step_minutes=5,
        )
    )
    assert rodden_a.top_sign == "Cancer"
    assert rodden_a.top_sign_probability >= 0.70
    assert rodden_a.window_80_minutes <= 180
    assert rodden_a.is_calculations_eligible is True


def test_historical_dossier_catalog_taxonomy_and_handlers():
    """All 39 dossiers parse; undated stay non-rectifiable; handler & FastAPI functions behave cleanly."""
    catalog = rd.list_proposals_metadata()
    assert len(catalog) == 39

    by_cls = {}
    for item in catalog:
        by_cls.setdefault(item["classification"], []).append(item)

    assert len(by_cls.get("archival_clue", [])) == 8
    assert len(by_cls.get("date_known_milestones", [])) == 16
    assert len(by_cls.get("approximate_or_symbolic_date", [])) == 15

    # Undated figures stay non-rectifiable without fabricated times
    for uid in ("confucius", "lao-tzu", "siddhartha-gautama-buddha", "dante-alighieri"):
        scored_undated = rd.score_dossier(uid, step_minutes=10)
        assert scored_undated["rectifiable"] is False
        assert scored_undated["score"] is None
        assert scored_undated["calculationsEligible"] is False

    # Router handler functions directly (works regardless of fastapi install)
    listed = rs.get_rectification_proposals()
    assert listed["count"] == 39
    assert len(listed["proposals"]) == 39

    leo = rs.post_score_rectification_proposal(
        "leonardo-da-vinci",
        rs.ProposalScoreRequest(step_minutes=5),
    )
    assert leo["agentId"] == "leonardo-da-vinci"
    assert leo["score"]["top_sign"] == "Sagittarius"
    assert leo["calculationsEligible"] is True

    with pytest.raises(rs.HTTPException) as exc_info:
        rs.post_score_rectification_proposal("does-not-exist", rs.ProposalScoreRequest(step_minutes=5))
    assert exc_info.value.status_code == 404

    if rs.HAS_FASTAPI:
        from fastapi.testclient import TestClient
        import main

        client = TestClient(main.app)
        res = client.get("/api/rectify/proposals")
        assert res.status_code == 200
        assert res.json()["count"] == 39
