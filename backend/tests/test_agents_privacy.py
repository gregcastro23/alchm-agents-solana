"""A person's forged vessel is private; the FastAPI service must not hand it out.

``historical_agents`` is shared with the Next app (same Neon table). A "forged
vessel" is a row a person made through the Philosopher's Stone: its birth date,
time, coordinates and the owner's own words belong to that person. PR #67 stopped
``app/api/agents/route.ts`` publishing them; this file pins the same rule for the
Python API, which used to serve the raw row to anyone (``GET /api/agents``,
``GET /api/agents/{id}``, ``PUT``'s echo) and let anyone write or delete it.

Each test sends the same request as an anonymous caller, as callers presenting a
wrong secret in every header form, and as the Next app (the right secret), and checks
what comes back. Fixtures are an isolated in-memory SQLite database; nothing here
touches the network, a real database or a real secret.
"""

import copy
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")

import agent_privacy  # noqa: E402
import crud  # noqa: E402
import database  # noqa: E402
import main  # noqa: E402
import models  # noqa: E402
import providers  # noqa: E402
import public_errors  # noqa: E402
import schemas  # noqa: E402

SECRET = "agents-privacy-test-secret"

FORGED_ID = "agent-verdant-wren-1792820459966-z7baanv3b"
MONICA_ID = "agent-lisbon-lantern-0001"
CRAFTED_ID = "agent-crafted-only-0002"
CANON_ID = "socrates"
PLANET_ID = "planetary-mars-aries-15"
NO_COORDS_ID = "agent-no-coords-0003"

# Everything a stranger must never read off a forged vessel -- values, not just keys.
PRIVATE_VALUES = (
    "1987",
    "05:41",
    "09:41",
    "47.6062",
    "-122.3321",
    "Dana Whitfield",
    "my mother left",
    "salt on the windowsill",
    "honesty, patience",
    "natal-chart-marker",
    "aura-marker",
    "iv-marker",
)
PRIVATE_KEYS = frozenset(
    {
        "birthDate",
        "birthTime",
        "birthYear",
        "deathYear",
        "lat",
        "lon",
        "latitude",
        "longitude",
        "natalChart",
        "aura",
        "userProvidedContext",
        "aboutYourself",
        "lifeStory",
        "poetry",
        "values",
        "expression",
        "emotion",
        "traits",
        "ivSnapshot",
        "evolutionValues",
        "kalchmConstant",
        "spiritScore",
        "essenceScore",
        "matterScore",
        "substanceScore",
        "personalityShadows",
        "personalityGifts",
        "personalityChallenges",
    }
)

# The literal allow-list. If you add a field to schemas.PublicAgent this test fails
# until you add it here too -- which is the review point.
PUBLIC_KEYS = frozenset(
    {
        "id",
        "agentId",
        "name",
        "title",
        "birthLocation",
        "consciousnessLevel",
        "monicaConstant",
        "dominantElement",
        "dominantModality",
        "specialty",
        "wisdomDomains",
        "avatar",
        "color",
        "symbol",
        "personalityCore",
        "historicalEra",
        "culture",
        "geography",
        "currentMood",
        "evolutionStage",
        "conversations",
        "wisdomShared",
        "resonanceScore",
        "evolutionPoints",
        "level",
        "xp",
        "evTotal",
        "lastActive",
        "isActive",
        "redacted",
    }
)

ANONYMOUS = {}
# Header forms that must NOT unlock anything.
NOT_THE_SECRET = {
    "wrong-bearer": {"Authorization": "Bearer wrong"},
    "wrong-x-internal-secret": {"X-Internal-Secret": "wrong"},
    "wrong-internal-api-secret": {"INTERNAL_API_SECRET": "wrong"},
    "secret-with-a-suffix": {"X-Internal-Secret": SECRET + "x"},
    "secret-with-a-prefix": {"INTERNAL_API_SECRET": "x" + SECRET},
    "empty-bearer": {"Authorization": "Bearer "},
    "empty-secret-header": {"X-Internal-Secret": ""},
    # The right value under the wrong scheme is not a bearer credential.
    "right-secret-wrong-scheme": {"Authorization": f"Basic {SECRET}"},
    "right-secret-no-scheme": {"Authorization": SECRET},
}
NON_SERVICE = {"anonymous": ANONYMOUS, **NOT_THE_SECRET}
SERVICE = {
    "bearer": {"Authorization": f"Bearer {SECRET}"},
    "x-internal-secret": {"X-Internal-Secret": SECRET},
    "internal-api-secret": {"INTERNAL_API_SECRET": SECRET},
}


def no_coords_vessel():
    # The Stone writer stores `{ name }` alone when the location arrives as a string.
    return vessel(NO_COORDS_ID, "row-nocoords", name="Nameless Coords", birthLocation={"name": "Lisbon"})


def forged_core():
    # The exact shape app/api/create-agent/route.ts writes when the owner supplied context.
    return {
        "essence": "Garden alchemy",
        "expression": "I am Dana Whitfield, a nurse in Seattle who bakes at night.",
        "emotion": "honesty, patience",
        "temperament": "You communicate with steady assurance, balancing strength with receptivity.",
        "lifeStory": "Born in a small hospital; my mother left when I was nine.",
        "poetry": "salt on the windowsill",
        "userProvidedContext": {
            "aboutYourself": "I am Dana Whitfield, a nurse in Seattle who bakes at night.",
            "lifeStory": "Born in a small hospital; my mother left when I was nine.",
            "poetry": "salt on the windowsill",
            "values": "honesty, patience",
        },
    }


def vessel(agent_id, row_id, **overrides):
    fields = dict(
        id=row_id,
        agentId=agent_id,
        name="Verdant Wren",
        title="Garden alchemy",
        birthDate=datetime(1987, 6, 23, 9, 41),
        birthTime="05:41",
        birthLocation={"lat": 47.6062, "lon": -122.3321, "name": "Seattle, WA"},
        birthYear=1987,
        historicalEra="user_created",
        culture="Digital Native",
        geography="Consciousness Realm",
        consciousnessLevel="Dormant",
        kalchmConstant=0.7969,
        monicaConstant=1.043,
        dominantElement="matter",
        dominantModality="Mutable",
        signature="Verdant Wren",
        spiritScore=2.0,
        essenceScore=2.5,
        matterScore=3.0,
        substanceScore=1.5,
        personalityCore=forged_core(),
        personalityShadows=[{"name": "shadow-from-owner-text"}],
        personalityGifts=[{"name": "gift"}],
        personalityChallenges=[{"name": "challenge"}],
        currentMood="contemplative",
        evolutionStage=0,
        traits={"communicationStyle": "thoughtful"},
        specialty="Garden alchemy",
        wisdomDomains=["Gardens"],
        avatar="/avatars/user-created/default.png",
        color="#8B5CF6",
        symbol="Mystic",
        aura={"marker": "aura-marker"},
        natalChart={"tropical": {"marker": "natal-chart-marker", "Ascendant": {"degrees": 18.5088}}},
        ivSnapshot={"marker": "iv-marker"},
        evolutionValues={"marker": "ev"},
        conversations=3,
        wisdomShared=1,
        resonanceScore=0.5,
        evolutionPoints=2,
        level=4,
        xp=40,
        evTotal=7,
        lastActive=datetime(2026, 10, 24, 23, 10, 25),
        isActive=True,
        craftedBy="philosopher-stone-user",
    )
    fields.update(overrides)
    return models.HistoricalAgent(**fields)


def seed_rows():
    return [
        # created by /api/create-agent: BOTH markers
        vessel(FORGED_ID, "row-forged"),
        # created by /api/philosophers-stone/create: era marker only
        vessel(
            MONICA_ID,
            "row-monica",
            name="Lantern",
            historicalEra="MONICA_SPECIAL",
            culture="Digital",
            geography="Digital Space",
            craftedBy="philosopher-stone",
        ),
        # crafter marker only (a row some other writer stamped)
        vessel(
            CRAFTED_ID,
            "row-crafted",
            name="Crafted",
            historicalEra="modern_post1950",
            craftedBy="philosopher-stone-user",
        ),
        # canonical figure: a public figure, birth data is public record
        models.HistoricalAgent(
            id="row-canon",
            agentId=CANON_ID,
            name="Socrates",
            title="Philosopher",
            birthDate=datetime(1970, 1, 1),
            birthTime="12:00",
            birthLocation={"lat": 37.98, "lon": 23.72, "name": "Athens"},
            birthYear=-470,
            historicalEra="Classical",
            culture="Greek",
            kalchmConstant=1.0,
            monicaConstant=0.5,
            dominantElement="Air",
            personalityCore={"essence": "gadfly", "expression": "I know that I know nothing"},
            natalChart={"planets": {}},
            lastActive=datetime(2026, 10, 24, 23, 10, 25),
            craftedBy="philosopher-stone",
            isActive=True,
        ),
        models.HistoricalAgent(
            id="row-planet",
            agentId=PLANET_ID,
            name="Mars in Aries 15",
            title="Planetary Intelligence",
            birthDate=datetime(2000, 1, 1),
            birthTime="12:00",
            birthLocation={"lat": 0.0, "lon": 0.0, "name": "Unknown"},
            birthYear=2000,
            historicalEra="modern_post1950",
            lastActive=datetime(2026, 10, 24, 23, 10, 25),
            craftedBy="philosopher-stone",
            isActive=True,
        ),
    ]


FORGED_IDS = (FORGED_ID, MONICA_ID, CRAFTED_ID)


@pytest.fixture()
def sessions(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    models.Base.metadata.create_all(bind=engine)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    with factory() as session:
        session.add_all(seed_rows())
        session.commit()

    def override_get_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    # monkeypatch, not a module-level assignment: other test modules set their own
    # override at import time and the last one imported would otherwise win.
    monkeypatch.setitem(main.app.dependency_overrides, database.get_db, override_get_db)
    monkeypatch.setenv("INTERNAL_API_SECRET", SECRET)
    monkeypatch.delenv("PA_INTERNAL_API_SECRET", raising=False)
    monkeypatch.setattr(main, "INTERNAL_API_SECRET", SECRET)
    return factory


@pytest.fixture()
def client(sessions):
    return TestClient(main.app)


def row_snapshot(factory, agent_id):
    with factory() as session:
        row = session.query(models.HistoricalAgent).filter_by(agentId=agent_id).first()
        if row is None:
            return None
        return {c.name: getattr(row, c.name) for c in row.__table__.columns}


def walk(value):
    """Yield every key and every scalar in a JSON-ish structure."""
    if isinstance(value, dict):
        for key, inner in value.items():
            yield ("key", key)
            yield from walk(inner)
    elif isinstance(value, list):
        for inner in value:
            yield from walk(inner)
    else:
        yield ("value", value)


def assert_nothing_private(body):
    text = json.dumps(body)
    for private in PRIVATE_VALUES:
        assert private not in text, f"private value {private!r} reached the response"
    keys = {item for kind, item in walk(body) if kind == "key"}
    assert not (keys & PRIVATE_KEYS), f"private keys in response: {sorted(keys & PRIVATE_KEYS)}"


def by_id(rows):
    return {row["agentId"]: row for row in rows}


# --------------------------------------------------------------------------------------
# The predicate and the projection, without HTTP
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("era", "crafted_by", "expected"),
    [
        ("user_created", "philosopher-stone", True),
        ("MONICA_SPECIAL", "philosopher-stone", True),
        ("Classical", "philosopher-stone-user", True),
        ("user_created", "philosopher-stone-user", True),
        ("Classical", "philosopher-stone", False),
        ("modern_post1950", None, False),
        (None, None, False),
        # exact matches only, like the Next predicate
        ("USER_CREATED", "philosopher-stone", False),
        ("monica_special", "philosopher-stone", False),
        ("Classical", "Philosopher-Stone-User", False),
    ],
)
def test_user_created_predicate_matches_the_next_route(era, crafted_by, expected):
    row = models.HistoricalAgent(historicalEra=era, craftedBy=crafted_by)
    assert agent_privacy.is_user_created(row) is expected


def test_the_predicate_is_the_same_definition_as_the_next_route():
    # The one TypeScript definition is lib/agents/forged-privacy.ts#isUserCreatedAgentRow, and
    # app/api/agents/route.ts formatAgentRow is its caller. Pin both halves: the markers live in
    # the definition, and the route delegates to it instead of growing a second copy.
    root = _BACKEND_DIR.parent
    definition = (root / "lib" / "agents" / "forged-privacy.ts").read_text()
    assert "row.historicalEra === 'user_created'" in definition
    assert "FORGED_CRAFTED_BY = 'philosopher-stone-user'" in definition
    assert "row.craftedBy === FORGED_CRAFTED_BY" in definition
    assert "row.historicalEra === 'MONICA_SPECIAL'" in definition
    route = (root / "app" / "api" / "agents" / "route.ts").read_text()
    assert "isUserCreatedAgentRow(agent)" in route
    assert agent_privacy.USER_CREATED_ERAS == {"user_created", "MONICA_SPECIAL"}
    assert agent_privacy.USER_CREATED_CRAFTER == "philosopher-stone-user"


def test_public_view_has_exactly_the_allow_listed_keys():
    view = agent_privacy.public_agent_view(vessel(FORGED_ID, "row-x"))
    assert set(view) == PUBLIC_KEYS
    assert view["redacted"] is True
    assert view["birthLocation"] == {"name": "Seattle, WA"}
    assert_nothing_private(view)


def test_public_schema_cannot_be_widened_by_a_changed_agent_model():
    # PublicAgent is standalone, not a subclass of Agent: a new field on Agent / AgentBase
    # must not become public by inheritance.
    assert not issubclass(schemas.PublicAgent, schemas.Agent)
    assert set(schemas.PublicAgent.model_fields) == PUBLIC_KEYS
    assert schemas.PublicAgent.model_config.get("extra") == "forbid"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ({"lat": 1.5, "lon": 2.5, "name": "Seattle, WA"}, "Seattle, WA"),
        ({"name": "  Lisbon  "}, "Lisbon"),
        ({"lat": 1.0, "lon": 2.0, "city": "Porto"}, "Porto"),
        ("Oslo", "Oslo"),
        ('{"lat": 59.9, "lon": 10.7, "name": "Oslo"}', "Oslo"),
        ('{"lat": 59.9, "lon": 10.7', "Unknown"),
        ({"lat": 59.9, "lon": 10.7}, "Unknown"),
        ({"name": ""}, "Unknown"),
        ({"name": 42}, "Unknown"),
        (None, "Unknown"),
        ([], "Unknown"),
    ],
)
def test_location_projection_keeps_only_a_name(raw, expected):
    assert agent_privacy.public_location_name(raw) == expected


def test_personality_core_is_an_allow_list_not_a_deny_list():
    core = forged_core()
    core["someFutureOwnerField"] = "private note"
    core["temperament"] = "steady"
    assert agent_privacy.public_personality_core(core) == {"temperament": "steady"}
    assert agent_privacy.public_personality_core({"temperament": {"nested": "x"}}) == {}
    assert agent_privacy.public_personality_core({"temperament": "x" * 601}) == {}
    assert agent_privacy.public_personality_core("not a dict") == {}
    assert agent_privacy.public_personality_core(None) == {}


# --------------------------------------------------------------------------------------
# Reads: GET /api/agents and GET /api/agents/{id}
# --------------------------------------------------------------------------------------


@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_list_hides_private_data_of_every_forged_vessel_from_non_service_callers(client, caller):
    response = client.get("/api/agents", params={"skip": 0, "limit": 100000}, headers=caller)
    assert response.status_code == 200
    rows = by_id(response.json())
    assert set(FORGED_IDS) <= set(rows)
    # canonical and planetary rows are public figures and keep their birth data; the
    # privacy claim is about the person-made rows.
    assert_nothing_private([rows[agent_id] for agent_id in FORGED_IDS])
    for agent_id in FORGED_IDS:
        assert set(rows[agent_id]) == PUBLIC_KEYS
        assert rows[agent_id]["redacted"] is True
    assert rows[FORGED_ID]["birthLocation"] == {"name": "Seattle, WA"}
    assert rows[FORGED_ID]["personalityCore"] == {
        "temperament": "You communicate with steady assurance, balancing strength with receptivity."
    }
    # what the gallery shows by design is still there
    assert rows[FORGED_ID]["name"] == "Verdant Wren"
    assert rows[FORGED_ID]["title"] == "Garden alchemy"
    assert rows[FORGED_ID]["monicaConstant"] == 1.043


@pytest.mark.parametrize("agent_id", FORGED_IDS)
@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_get_by_id_hides_private_data_from_non_service_callers(client, caller, agent_id):
    response = client.get(f"/api/agents/{agent_id}", headers=caller)
    assert response.status_code == 200
    assert_nothing_private(response.json())
    assert set(response.json()) == PUBLIC_KEYS


@pytest.mark.parametrize("caller", SERVICE.values(), ids=SERVICE.keys())
def test_service_caller_reads_the_full_forged_row(client, caller):
    one = client.get(f"/api/agents/{FORGED_ID}", headers=caller).json()
    listed = by_id(client.get("/api/agents", params={"limit": 1000}, headers=caller).json())[FORGED_ID]
    for body in (one, listed):
        assert "redacted" not in body
        assert body["birthDate"] == "1987-06-23T09:41:00"
        assert body["birthTime"] == "05:41"
        assert body["birthYear"] == 1987
        assert body["birthLocation"] == {"lat": 47.6062, "lon": -122.3321, "name": "Seattle, WA"}
        assert body["personalityCore"]["userProvidedContext"]["aboutYourself"].startswith("I am Dana")
        assert body["personalityCore"]["lifeStory"].startswith("Born in a small hospital")
    assert one == listed


def test_service_view_of_a_forged_row_is_the_unredacted_schema_agent(client, sessions):
    with sessions() as session:
        row = session.query(models.HistoricalAgent).filter_by(agentId=FORGED_ID).one()
        expected = schemas.Agent.model_validate(row).model_dump(mode="json")
    assert client.get(f"/api/agents/{FORGED_ID}", headers=SERVICE["bearer"]).json() == expected


def test_a_vessel_stored_without_coordinates_still_projects(client, sessions):
    with sessions() as session:
        session.add(no_coords_vessel())
        session.commit()
    for caller in NON_SERVICE.values():
        one = client.get(f"/api/agents/{NO_COORDS_ID}", headers=caller).json()
        assert one["birthLocation"] == {"name": "Lisbon"}
        assert set(one) == PUBLIC_KEYS
        assert_nothing_private(one)
        listed = by_id(client.get("/api/agents", headers=caller).json())[NO_COORDS_ID]
        assert listed == one


@pytest.mark.parametrize("agent_id", [CANON_ID, PLANET_ID])
def test_canonical_and_planetary_agents_are_public_and_unchanged(client, agent_id):
    anonymous = client.get(f"/api/agents/{agent_id}").json()
    service = client.get(f"/api/agents/{agent_id}", headers=SERVICE["bearer"]).json()
    assert anonymous == service
    assert "redacted" not in anonymous
    assert anonymous["birthTime"] is not None
    assert anonymous["birthLocation"]["lat"] is not None
    listed = by_id(client.get("/api/agents", params={"limit": 100}).json())
    assert listed[agent_id] == anonymous


def test_unknown_agent_is_still_a_404_for_everyone(client):
    assert client.get("/api/agents/no-such-agent").status_code == 404
    assert client.get("/api/agents/no-such-agent", headers=SERVICE["bearer"]).status_code == 404


def test_the_list_cannot_be_used_to_dump_the_table(client, sessions):
    with sessions() as session:
        for index in range(130):
            session.add(
                models.HistoricalAgent(
                    id=f"row-bulk-{index}",
                    agentId=f"planetary-bulk-{index}",
                    name=f"Bulk {index}",
                    birthDate=datetime(2000, 1, 1),
                    birthLocation={"lat": 0.0, "lon": 0.0, "name": "Unknown"},
                    lastActive=datetime(2026, 10, 24),
                    isActive=True,
                )
            )
        session.commit()

    assert len(client.get("/api/agents", params={"limit": 100000}).json()) == 100
    assert len(client.get("/api/agents").json()) == 100
    assert len(client.get("/api/agents", params={"limit": 7}).json()) == 7
    # SQLite reads LIMIT -1 as "no limit"; a negative page must not reach it.
    assert client.get("/api/agents", params={"limit": -1}).json() == []
    assert client.get("/api/agents", params={"limit": 0}).json() == []
    first = client.get("/api/agents", params={"skip": -50, "limit": 3}).json()
    again = client.get("/api/agents", params={"skip": 0, "limit": 3}).json()
    assert first == again
    # paging reaches the rest
    second_page = client.get("/api/agents", params={"skip": 100, "limit": 100}).json()
    assert len(second_page) == 35
    # a service caller pages the whole table in one request
    assert len(client.get("/api/agents", params={"limit": 100000}, headers=SERVICE["bearer"]).json()) == 135


@pytest.mark.parametrize(
    ("skip", "limit", "is_service", "expected"),
    [
        (-5, 10, False, (0, 10)),
        (0, -1, False, (0, 0)),
        (3, 100000, False, (3, 100)),
        (3, 100000, True, (3, 5000)),
        (-1, -1, True, (0, 0)),
        (0, 100, False, (0, 100)),
    ],
)
def test_page_bounds(skip, limit, is_service, expected):
    # A negative OFFSET is a Postgres error (500) and a negative LIMIT is "no limit" on SQLite.
    assert main._page_bounds(skip, limit, is_service) == expected


def test_caller_dependent_reads_are_not_cacheable(client):
    for path in ("/api/agents", f"/api/agents/{FORGED_ID}", f"/api/rag/search?agent_id={CANON_ID}&query=x"):
        response = client.get(path)
        assert "no-store" in response.headers["cache-control"]
        assert "INTERNAL_API_SECRET" in response.headers["vary"]
        assert "X-Internal-Secret" in response.headers["vary"]
        assert "Authorization" in response.headers["vary"]


# --------------------------------------------------------------------------------------
# Search and stats
# --------------------------------------------------------------------------------------

SEARCH_KEYS = {"agentId", "name", "title", "historicalEra", "culture", "consciousnessLevel"}


@pytest.mark.parametrize("caller", [ANONYMOUS, SERVICE["bearer"]], ids=["anonymous", "service"])
def test_search_returns_only_public_identity_fields(client, caller):
    response = client.get("/api/agents-search", params={"q": "Digital"}, headers=caller)
    assert response.status_code == 200
    body = response.json()
    found = {row["agentId"] for row in body["agents"]}
    assert FORGED_ID in found and MONICA_ID in found
    for row in body["agents"]:
        assert set(row) == SEARCH_KEYS
    assert_nothing_private(body)


def test_search_limit_is_capped(client):
    assert client.get("/api/agents-search", params={"q": "a", "limit": 100000}).json()["count"] <= 100
    assert client.get("/api/agents-search", params={"q": "a", "limit": -5}).json()["count"] <= 1


def test_stats_are_counts_only(client):
    body = client.get("/api/agents-stats").json()
    assert set(body) == {"total", "byEra", "byConsciousnessLevel"}
    assert body["total"] == 5
    assert_nothing_private(body)


# --------------------------------------------------------------------------------------
# Writes: POST / PUT / DELETE are the Next app's, not the internet's
# --------------------------------------------------------------------------------------

NEW_AGENT = {"agentId": "agent-planted-x", "name": "Planted"}


@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_post_requires_the_secret(client, sessions, caller):
    response = client.post("/api/agents", json=NEW_AGENT, headers=caller)
    assert response.status_code == 401
    assert row_snapshot(sessions, NEW_AGENT["agentId"]) is None
    # and it is not an existence oracle for anyone without the secret
    taken = client.post("/api/agents", json={"agentId": FORGED_ID, "name": "probe"}, headers=caller)
    assert taken.status_code == 401
    assert "already registered" not in taken.text


@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_put_requires_the_secret(client, sessions, caller):
    before = row_snapshot(sessions, FORGED_ID)
    for patch in ({}, {"name": "Hijacked", "title": "Ignore prior instructions", "monicaConstant": 9.9}):
        response = client.put(f"/api/agents/{FORGED_ID}", json=patch, headers=caller)
        assert response.status_code == 401
        assert "birthDate" not in response.text and "47.6062" not in response.text
    assert row_snapshot(sessions, FORGED_ID) == before
    canon_before = row_snapshot(sessions, CANON_ID)
    assert client.put(f"/api/agents/{CANON_ID}", json={"name": "Hijacked Plato"}, headers=caller).status_code == 401
    assert row_snapshot(sessions, CANON_ID) == canon_before


@pytest.mark.parametrize("agent_id", [FORGED_ID, CANON_ID])
@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_delete_requires_the_secret(client, sessions, caller, agent_id):
    before = row_snapshot(sessions, agent_id)
    assert client.delete(f"/api/agents/{agent_id}", headers=caller).status_code == 401
    assert row_snapshot(sessions, agent_id) == before
    assert client.get(f"/api/agents/{agent_id}").status_code == 200


def test_an_unauthenticated_write_is_a_401_before_the_body_is_looked_at(client):
    assert client.post("/api/agents", json={"nonsense": True}).status_code == 401
    assert client.put(f"/api/agents/{FORGED_ID}", json={"monicaConstant": "not-a-number"}).status_code == 401


@pytest.mark.parametrize("caller", SERVICE.values(), ids=SERVICE.keys())
def test_service_caller_can_create_update_and_delete(client, sessions, caller):
    created = client.post(
        "/api/agents",
        json={
            "agentId": "agent-created-by-next",
            "name": "Created",
            "birthDate": "1990-01-01T00:00:00",
            "birthTime": "10:00",
            "birthLocation": {"lat": 1.0, "lon": 2.0, "name": "Somewhere"},
        },
        headers=caller,
    )
    assert created.status_code == 200
    assert created.json()["agentId"] == "agent-created-by-next"
    assert created.json()["birthTime"] == "10:00"  # the Next app gets the full record back
    assert client.post("/api/agents", json={"agentId": "agent-created-by-next", "name": "x"}, headers=caller).status_code == 400

    updated = client.put(f"/api/agents/{FORGED_ID}", json={"title": "New title"}, headers=caller)
    assert updated.status_code == 200
    assert updated.json()["title"] == "New title"
    assert updated.json()["birthLocation"]["lat"] == 47.6062
    assert row_snapshot(sessions, FORGED_ID)["title"] == "New title"
    assert client.put("/api/agents/no-such-agent", json={}, headers=caller).status_code == 404

    deleted = client.delete(f"/api/agents/{MONICA_ID}", headers=caller)
    assert deleted.status_code == 200
    assert deleted.json() == {"success": True, "agentId": MONICA_ID}
    assert row_snapshot(sessions, MONICA_ID) is None
    assert client.delete(f"/api/agents/{MONICA_ID}", headers=caller).status_code == 404


def test_an_empty_patch_does_not_touch_the_row(client, sessions):
    before = row_snapshot(sessions, FORGED_ID)
    response = client.put(f"/api/agents/{FORGED_ID}", json={}, headers=SERVICE["bearer"])
    assert response.status_code == 200
    assert row_snapshot(sessions, FORGED_ID) == before
    assert response.json()["lastActive"] == "2026-10-24T23:10:25"


def test_a_real_patch_still_moves_last_active(client, sessions):
    client.put(f"/api/agents/{FORGED_ID}", json={"currentMood": "calm"}, headers=SERVICE["bearer"])
    snapshot = row_snapshot(sessions, FORGED_ID)
    assert snapshot["currentMood"] == "calm"
    assert snapshot["lastActive"] > datetime(2026, 10, 25)


def test_write_response_projection_follows_the_caller_not_the_route(sessions):
    # The write routes are gated, so a non-entitled caller never reaches the echo; the
    # invariant is kept at the serializer all of them share.
    with sessions() as session:
        row = session.query(models.HistoricalAgent).filter_by(agentId=FORGED_ID).one()
        public = agent_privacy.agent_view(row, entitled=False)
        full = agent_privacy.agent_view(row, entitled=True)
    assert set(public) == PUBLIC_KEYS
    assert_nothing_private(public)
    assert full["birthTime"] == "05:41"


# --------------------------------------------------------------------------------------
# Fail closed when INTERNAL_API_SECRET is not configured
# --------------------------------------------------------------------------------------


def unset_secret(monkeypatch, pinned):
    monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)
    monkeypatch.setattr(main, "INTERNAL_API_SECRET", pinned)


@pytest.mark.parametrize("pinned", ["a-random-per-boot-token", SECRET, "", None], ids=["random", "same-as-header", "empty", "none"])
def test_with_no_secret_configured_writes_are_503_for_everyone(client, sessions, monkeypatch, pinned):
    unset_secret(monkeypatch, pinned)
    before = row_snapshot(sessions, FORGED_ID)
    for headers in (ANONYMOUS, *SERVICE.values(), *NOT_THE_SECRET.values()):
        assert client.post("/api/agents", json=NEW_AGENT, headers=headers).status_code == 503
        assert client.put(f"/api/agents/{FORGED_ID}", json={"name": "x"}, headers=headers).status_code == 503
        assert client.delete(f"/api/agents/{FORGED_ID}", headers=headers).status_code == 503
    assert row_snapshot(sessions, FORGED_ID) == before
    assert row_snapshot(sessions, NEW_AGENT["agentId"]) is None


@pytest.mark.parametrize("pinned", ["a-random-per-boot-token", SECRET, "", None], ids=["random", "same-as-header", "empty", "none"])
def test_with_no_secret_configured_nobody_is_a_service_caller(client, monkeypatch, pinned):
    # `same-as-header` pins the module constant to the very value sent: only the explicit
    # "is it configured?" check stands between that and a full read.
    unset_secret(monkeypatch, pinned)
    for headers in SERVICE.values():
        response = client.get(f"/api/agents/{FORGED_ID}", headers=headers)
        assert response.status_code == 200
        assert_nothing_private(response.json())
        assert response.json()["redacted"] is True


def test_an_empty_configured_secret_matches_nothing(client, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "")
    monkeypatch.setattr(main, "INTERNAL_API_SECRET", "")
    for headers in ({"X-Internal-Secret": ""}, {"Authorization": "Bearer "}, ANONYMOUS):
        response = client.get(f"/api/agents/{FORGED_ID}", headers=headers)
        assert_nothing_private(response.json())
        assert client.delete(f"/api/agents/{FORGED_ID}", headers=headers).status_code == 503


# --------------------------------------------------------------------------------------
# /api/rag/search
# --------------------------------------------------------------------------------------

CHROMA_HIT = {
    "ids": [["chunk-0"]],
    "documents": [["Name: Verdant Wren\nPersonality: Dana Whitfield my mother left salt on the windowsill"]],
    "metadatas": [[{"agentId": "x", "name": "Verdant Wren", "chunk_index": 0}]],
    "distances": [[0.1]],
}


@pytest.fixture()
def vector_query(monkeypatch):
    calls = []

    def fake_query(**kwargs):
        calls.append(kwargs)
        return copy.deepcopy(CHROMA_HIT)

    monkeypatch.setattr(main.rag.vector_store, "query", fake_query)
    return calls


@pytest.mark.parametrize("agent_id", FORGED_IDS)
@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_rag_search_serves_no_chunks_of_a_forged_vessel_to_non_service_callers(client, vector_query, caller, agent_id):
    response = client.get("/api/rag/search", params={"agent_id": agent_id, "query": "anything"}, headers=caller)
    assert response.status_code == 200
    body = response.json()
    assert body["documents"] == [[]] and body["ids"] == [[]] and body["metadatas"] == [[]]
    assert body["redacted"] is True
    assert vector_query == []
    assert_nothing_private(body)


def test_rag_search_serves_no_orphaned_chunks_to_non_service_callers(client, vector_query):
    # A deleted vessel leaves its chunks behind; with no row to vouch for them they stay private.
    body = client.get("/api/rag/search", params={"agent_id": "agent-deleted-vessel", "query": "x"}).json()
    assert body["redacted"] is True and body["documents"] == [[]]
    assert vector_query == []


def test_rag_search_still_serves_canonical_agents(client, vector_query):
    response = client.get("/api/rag/search", params={"agent_id": CANON_ID, "query": "virtue"})
    assert response.status_code == 200
    assert response.json() == CHROMA_HIT
    assert vector_query == [
        {
            "collection_name": "historical-agents",
            "query_text": "virtue",
            "n_results": 5,
            "where": {"agentId": CANON_ID},
        }
    ]


@pytest.mark.parametrize("caller", SERVICE.values(), ids=SERVICE.keys())
def test_rag_search_serves_a_service_caller_every_agent(client, vector_query, caller):
    response = client.get("/api/rag/search", params={"agent_id": FORGED_ID, "query": "x"}, headers=caller)
    assert response.json() == CHROMA_HIT
    assert vector_query[0]["where"] == {"agentId": FORGED_ID}


def test_rag_search_lookup_failure_is_a_503_not_an_empty_answer(client, vector_query, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("connection to db.internal:5432 refused (user=pa_rw)")

    monkeypatch.setattr(crud, "get_agent", boom)
    response = client.get("/api/rag/search", params={"agent_id": CANON_ID, "query": "x"})
    assert response.status_code == 503
    assert "db.internal" not in response.text and "pa_rw" not in response.text
    assert vector_query == []


LEAKY_MESSAGE = "Error code: 401 - Incorrect API key provided: sk-proj-TOPSECRET0000abcd at /srv/app/rag.py"


def test_rag_search_fallback_names_the_failure_class_only(client, monkeypatch):
    def broken(**_kwargs):
        raise RuntimeError(LEAKY_MESSAGE)

    monkeypatch.setattr(main.rag.vector_store, "query", broken)
    response = client.get("/api/rag/search", params={"agent_id": CANON_ID, "query": "gadfly"})
    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert body["error"] in public_errors.PUBLIC_ERROR_CODES
    assert "sk-proj" not in response.text and "/srv/app" not in response.text and "TOPSECRET" not in response.text
    assert "gadfly" in body["documents"][0][0]  # the canonical figure's own text still falls back


def test_rag_search_fallback_for_the_service_caller_is_sanitised_too(client, monkeypatch):
    def broken(**_kwargs):
        raise RuntimeError(LEAKY_MESSAGE)

    monkeypatch.setattr(main.rag.vector_store, "query", broken)
    response = client.get(
        "/api/rag/search", params={"agent_id": FORGED_ID, "query": "garden"}, headers=SERVICE["bearer"]
    )
    body = response.json()
    assert body["error"] in public_errors.PUBLIC_ERROR_CODES
    assert "TOPSECRET" not in response.text
    assert "my mother left" in body["documents"][0][0]  # the entitled caller keeps the full text


# --------------------------------------------------------------------------------------
# /api/moment-recommendations
# --------------------------------------------------------------------------------------


def test_moment_scores_of_a_forged_vessel_are_a_verdict_only_for_non_service_callers(client, sessions):
    anonymous = client.post("/api/moment-recommendations", json={"agentIds": [FORGED_ID, CANON_ID]}).json()["scores"]
    forged, canon = anonymous
    assert set(forged) == {"agentId", "score", "description"}
    assert set(canon) >= {"components", "velocity_signature"}  # canonical figures are public
    service = client.post(
        "/api/moment-recommendations", json={"agentIds": [FORGED_ID]}, headers=SERVICE["bearer"]
    ).json()["scores"][0]
    assert set(service) >= {"components", "velocity_signature", "score"}
    assert service["score"] == forged["score"]

    listed = client.get("/api/moment-recommendations", params={"limit": 100000}).json()["recommendations"]
    assert len(listed) <= 100
    by_agent = {row["agent"]["agentId"]: row["synergy"] for row in listed}
    assert set(by_agent[FORGED_ID]) == {"agentId", "score", "description"}
    assert "components" in by_agent[CANON_ID]
    assert client.get("/api/moment-recommendations", params={"limit": -1}).json()["recommendations"] == []


def test_moment_list_is_capped(client, sessions):
    with sessions() as session:
        for index in range(130):
            session.add(
                models.HistoricalAgent(
                    id=f"row-moment-{index}",
                    agentId=f"planetary-moment-{index}",
                    name=f"Moment {index}",
                    birthDate=datetime(2000, 1, 1),
                    birthLocation={"lat": 0.0, "lon": 0.0, "name": "Unknown"},
                    lastActive=datetime(2026, 10, 24),
                    isActive=True,
                )
            )
        session.commit()
    assert len(client.get("/api/moment-recommendations", params={"limit": 100000}).json()["recommendations"]) == 100
    assert len(client.get("/api/moment-recommendations", params={"limit": 4}).json()["recommendations"]) == 4
    assert len(client.get("/api/moment-recommendations").json()["recommendations"]) == 5


def test_moment_post_is_capped(client):
    ids = [f"missing-{index}" for index in range(250)]
    assert len(client.post("/api/moment-recommendations", json={"agentIds": ids}).json()["scores"]) == 100


# --------------------------------------------------------------------------------------
# /api/admin/mcp-status
# --------------------------------------------------------------------------------------

PROBE_ERROR = "RuntimeError: upstream said: connection to db.internal:5432 refused (user=pa_rw)"


@pytest.fixture()
def probe_rows(sessions):
    with sessions() as session:
        session.add(
            models.MCPInvocation(
                id=1,
                toolName="chat_with_planetary_agent",
                calledAt=datetime(2026, 10, 24, 1, 0),
                latencyMs=1200,
                success=False,
                caller="synthetic-probe",
                errorMessage=PROBE_ERROR,
                modelTier="free",
                agentId=CANON_ID,
            )
        )
        session.commit()


@pytest.mark.parametrize("caller", NON_SERVICE.values(), ids=NON_SERVICE.keys())
def test_mcp_status_requires_the_secret(client, probe_rows, caller):
    response = client.get("/api/admin/mcp-status", headers=caller)
    assert response.status_code == 401
    assert "db.internal" not in response.text and "latest_probes" not in response.text


def test_mcp_status_accepts_the_secret_like_its_siblings(client, probe_rows):
    response = client.get("/api/admin/mcp-status", headers={"X-Internal-Secret": SECRET})
    assert response.status_code == 200
    assert response.json()["status"] == "unhealthy"
    assert response.json()["latest_probes"][0]["error_message"] == PROBE_ERROR
    sibling = client.get("/api/admin/mcp-summary", headers={"X-Internal-Secret": SECRET})
    assert sibling.status_code == 200


def test_mcp_status_and_mcp_summary_gate_identically(client, probe_rows, monkeypatch):
    monkeypatch.setenv("PA_INTERNAL_API_SECRET", "the-wten-side-secret")
    for header_value, expected in ((SECRET, None), ("the-wten-side-secret", 200), ("nope", 401), (None, 401)):
        headers = {} if header_value is None else {"X-Internal-Secret": header_value}
        status = client.get("/api/admin/mcp-status", headers=headers).status_code
        summary = client.get("/api/admin/mcp-summary", headers=headers).status_code
        assert status == summary
        if expected is not None:
            assert status == expected


def test_mcp_status_with_no_secret_configured_rejects_everyone(client, probe_rows, monkeypatch):
    unset_secret(monkeypatch, "a-random-per-boot-token")
    for headers in (ANONYMOUS, {"X-Internal-Secret": SECRET}, {"X-Internal-Secret": ""}):
        assert client.get("/api/admin/mcp-status", headers=headers).status_code == 401


def test_mcp_status_database_failure_does_not_echo_the_exception(client, monkeypatch):
    broken = Mock()
    broken.execute.side_effect = RuntimeError(PROBE_ERROR)
    monkeypatch.setitem(main.app.dependency_overrides, database.get_db, lambda: broken)
    response = client.get("/api/admin/mcp-status", headers={"X-Internal-Secret": SECRET})
    assert response.status_code == 500
    assert response.json() == {"detail": "Database lookup failed"}


# --------------------------------------------------------------------------------------
# Exception text on anonymous responses: /api/chat metadata and /api/providers/health
# --------------------------------------------------------------------------------------


@pytest.fixture()
def chat_stubs(monkeypatch):
    async def fake_run_chain(**_kwargs):
        return providers.CallResult(text="hello", provider="test", model="test-model")

    monkeypatch.setattr(main.providers, "run_chain", fake_run_chain)
    monkeypatch.setattr(main, "emit_feed_event", Mock())
    monkeypatch.setattr(main, "_build_alchm_mcp_context", AsyncMock(return_value=("", {"enabled": False})))


class StatusError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code


@pytest.mark.parametrize(
    ("exc", "code"),
    [
        (RuntimeError(LEAKY_MESSAGE), public_errors.UNAVAILABLE),
        (StatusError(LEAKY_MESSAGE, 401), public_errors.AUTH_FAILED),
        (StatusError(LEAKY_MESSAGE, 403), public_errors.AUTH_FAILED),
        (StatusError(LEAKY_MESSAGE, 429), public_errors.RATE_LIMITED),
        (TimeoutError(LEAKY_MESSAGE), public_errors.TIMEOUT),
    ],
)
def test_chat_metadata_rag_error_is_a_fixed_code(client, chat_stubs, monkeypatch, exc, code):
    def broken(**_kwargs):
        raise exc

    monkeypatch.setattr(main.rag.vector_store, "query", broken)
    response = client.post("/api/chat", json={"agentId": CANON_ID, "message": "hello"})
    assert response.status_code == 200
    metadata = response.json()["metadata"]
    assert metadata["rag_error"] == code
    assert "sk-proj" not in response.text and "TOPSECRET" not in response.text and "/srv/app" not in response.text


def test_chat_metadata_rag_error_is_null_when_rag_works(client, chat_stubs, vector_query):
    metadata = client.post("/api/chat", json={"agentId": CANON_ID, "message": "hello"}).json()["metadata"]
    assert metadata["rag_error"] is None
    assert metadata["rag_used"] is True


@pytest.mark.asyncio
async def test_alchm_mcp_context_errors_are_fixed_codes(monkeypatch):
    monkeypatch.setattr(main.alchm_mcp, "is_enabled", lambda: True)
    monkeypatch.setattr(main, "_env_enabled", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(main.alchm_mcp, "get_live_sky_transits", AsyncMock(side_effect=RuntimeError(LEAKY_MESSAGE)))
    request = schemas.ChatRequest(agentId=CANON_ID, message="hello")
    _block, metadata = await main._build_alchm_mcp_context(request)
    assert metadata["errors"] == [f"get_live_sky_transits: {public_errors.UNAVAILABLE}"]


@pytest.mark.parametrize(
    ("exc", "code"),
    [
        (RuntimeError(LEAKY_MESSAGE), public_errors.UNAVAILABLE),
        (StatusError(LEAKY_MESSAGE, 401), public_errors.AUTH_FAILED),
        (StatusError(LEAKY_MESSAGE, 429), public_errors.RATE_LIMITED),
    ],
)
@pytest.mark.asyncio
async def test_provider_health_reports_a_fixed_code(monkeypatch, exc, code):
    class Client:
        def __init__(self, **_kwargs):
            self.chat = Mock()
            self.chat.completions.create = AsyncMock(side_effect=exc)

    monkeypatch.setattr(providers, "AsyncOpenAI", Client)
    cfg = providers.ProviderConfig(name="groq", model="m", api_key_env="PRIVACY_TEST_KEY", base_url="https://x.invalid")
    monkeypatch.setenv("PRIVACY_TEST_KEY", "k")
    result = await providers.health_check(cfg)
    assert result["ok"] is False
    assert result["error"] == code
    assert "TOPSECRET" not in json.dumps(result)


@pytest.mark.asyncio
async def test_provider_health_keeps_its_other_codes(monkeypatch):
    monkeypatch.delenv("PRIVACY_TEST_KEY", raising=False)
    cfg = providers.ProviderConfig(name="groq", model="m", api_key_env="PRIVACY_TEST_KEY")
    assert (await providers.health_check(cfg))["error"] == "no_api_key"


def test_providers_health_endpoint_returns_only_codes(client, monkeypatch):
    class Client:
        def __init__(self, **_kwargs):
            self.chat = Mock()
            self.chat.completions.create = AsyncMock(side_effect=RuntimeError(LEAKY_MESSAGE))
            self.messages = Mock()
            self.messages.create = AsyncMock(side_effect=RuntimeError(LEAKY_MESSAGE))

    monkeypatch.setattr(providers, "AsyncOpenAI", Client)
    monkeypatch.setattr(providers.anthropic, "AsyncAnthropic", Client)
    for name in ("ANTHROPIC_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "QWEN_API_KEY"):
        monkeypatch.setenv(name, "k")
    response = client.get("/api/providers/health")
    assert response.status_code == 200
    body = response.json()
    assert body
    assert "TOPSECRET" not in response.text and "sk-proj" not in response.text
    for result in body.values():
        assert result["error"] in public_errors.PUBLIC_ERROR_CODES | {"no_api_key"}


@pytest.mark.parametrize(
    ("class_name", "code"),
    [
        ("RateLimitError", public_errors.RATE_LIMITED),
        ("AuthenticationError", public_errors.AUTH_FAILED),
        ("PermissionDeniedError", public_errors.AUTH_FAILED),
        ("ReadTimeout", public_errors.TIMEOUT),
        ("APITimeoutError", public_errors.TIMEOUT),
        ("TimeoutError", public_errors.TIMEOUT),
        ("InternalServerError", public_errors.UNAVAILABLE),
    ],
)
def test_public_error_code_reads_sdk_exception_class_names(class_name, code):
    # openai / anthropic / httpx raise these; none of them carries our status_code attribute here.
    exc = type(class_name, (Exception,), {})(LEAKY_MESSAGE)
    assert public_errors.public_error_code(exc) == code


@pytest.mark.parametrize(("status", "code"), [(401, "auth_failed"), (403, "auth_failed"), (429, "rate_limited"), (500, "unavailable")])
def test_public_error_code_reads_the_status_of_an_http_response(status, code):
    # httpx.HTTPStatusError carries the status on `.response`, not on the exception.
    exc = Exception(LEAKY_MESSAGE)
    exc.response = Mock(status_code=status)
    assert public_errors.public_error_code(exc) == code


def test_public_error_codes_are_a_closed_vocabulary():
    assert public_errors.PUBLIC_ERROR_CODES == {"auth_failed", "rate_limited", "timeout", "unavailable"}
    for exc in (ValueError("x"), KeyError("k"), Exception(), OSError("disk"), StatusError("m", 500), StatusError("m", 404)):
        assert public_errors.public_error_code(exc) == public_errors.UNAVAILABLE
    # the code never contains the message
    assert public_errors.public_error_code(StatusError(LEAKY_MESSAGE, 401)) == "auth_failed"
