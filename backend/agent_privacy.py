"""Who may read a user-created agent's private data, and what everyone else sees.

A "forged vessel" is a ``historical_agents`` row a person created through the
Philosopher's Stone (``/api/create-agent``, ``/api/philosophers-stone/create``).
Its birth date, birth time, coordinates and the owner's own words are that
person's private data. PR #67 withheld them in the Next route
(``app/api/agents/route.ts``); this module is the same rule for the FastAPI
service, which serves the same table to anyone.

Two decisions live here and nowhere else:

* ``is_user_created`` -- the SAME predicate as ``isUserCreated`` in
  ``app/api/agents/route.ts``. Keep them identical; a row one side calls private
  and the other calls public is a leak.
* ``public_agent_view`` -- what a caller WITHOUT the internal secret sees of such
  a row. It is built field by field into ``schemas.PublicAgent`` (an allow-list),
  never as "the full row minus a few keys".

Canonical figures and planetary agents are public figures and are not touched.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Mapping

import schemas

# ``historicalEra`` values written by the two vessel writers, and the ``craftedBy``
# marker of /api/create-agent. Mirrors app/api/agents/route.ts formatAgentRow.
USER_CREATED_ERAS = frozenset({"user_created", "MONICA_SPECIAL"})
USER_CREATED_CRAFTER = "philosopher-stone-user"

# The only ``personalityCore`` keys an anonymous caller may see. ``temperament`` is
# derived from the stat dials, not typed by the owner. The writers copy the owner's
# words into ``expression`` (about yourself), ``emotion`` (values), ``lifeStory``,
# ``poetry`` and ``userProvidedContext``; none of those is listed, and a key added
# to the core later is private until someone adds it here on purpose.
PUBLIC_PERSONALITY_CORE_KEYS = ("temperament",)
MAX_PUBLIC_CORE_VALUE_CHARS = 600

UNKNOWN_PLACE = "Unknown"


def is_user_created(row: Any) -> bool:
    """True for a person's forged vessel (private), False for canonical / planetary agents."""
    return (
        getattr(row, "historicalEra", None) in USER_CREATED_ERAS
        or getattr(row, "craftedBy", None) == USER_CREATED_CRAFTER
    )


def public_location_name(raw: Any) -> str:
    """The place NAME from whatever shape ``birthLocation`` holds; never coordinates."""
    if isinstance(raw, str):
        text = raw.strip()
        if text.startswith("{"):
            # A location stored as JSON text. Take its name; if it will not parse,
            # say nothing rather than echo a string that may hold coordinates.
            try:
                raw = json.loads(text)
            except ValueError:
                return UNKNOWN_PLACE
        else:
            return text or UNKNOWN_PLACE
    if isinstance(raw, Mapping):
        for key in ("name", "city"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return UNKNOWN_PLACE


def public_personality_core(raw: Any) -> Dict[str, str]:
    """``personalityCore`` reduced to ``PUBLIC_PERSONALITY_CORE_KEYS`` (string values only)."""
    if not isinstance(raw, Mapping):
        return {}
    kept: Dict[str, str] = {}
    for key in PUBLIC_PERSONALITY_CORE_KEYS:
        value = raw.get(key)
        if isinstance(value, str) and value.strip() and len(value) <= MAX_PUBLIC_CORE_VALUE_CHARS:
            kept[key] = value
    return kept


def _string_list(raw: Any) -> List[str]:
    return [item for item in raw if isinstance(item, str)] if isinstance(raw, list) else []


def public_agent_view(row: Any) -> Dict[str, Any]:
    """The public projection of one row, as a JSON-ready dict."""

    def get(name: str) -> Any:
        return getattr(row, name, None)

    return schemas.PublicAgent(
        id=str(get("id")),
        agentId=get("agentId"),
        name=get("name"),
        title=get("title"),
        birthLocation=schemas.PublicBirthLocation(name=public_location_name(get("birthLocation"))),
        consciousnessLevel=get("consciousnessLevel"),
        monicaConstant=get("monicaConstant"),
        dominantElement=get("dominantElement"),
        dominantModality=get("dominantModality"),
        specialty=get("specialty"),
        wisdomDomains=_string_list(get("wisdomDomains")),
        avatar=get("avatar"),
        color=get("color"),
        symbol=get("symbol"),
        personalityCore=public_personality_core(get("personalityCore")),
        historicalEra=get("historicalEra"),
        culture=get("culture"),
        geography=get("geography"),
        currentMood=get("currentMood"),
        evolutionStage=get("evolutionStage"),
        conversations=get("conversations"),
        wisdomShared=get("wisdomShared"),
        resonanceScore=get("resonanceScore"),
        evolutionPoints=get("evolutionPoints"),
        level=get("level"),
        xp=get("xp"),
        evTotal=get("evTotal"),
        lastActive=get("lastActive"),
        isActive=get("isActive"),
    ).model_dump(mode="json")


def agent_view(row: Any, *, entitled: bool) -> Dict[str, Any]:
    """One row as the caller may see it.

    ``entitled`` is "this request presented INTERNAL_API_SECRET". An entitled caller,
    and anyone reading a row that is not a person's vessel, gets the full
    ``schemas.Agent`` record exactly as before; everyone else reading a user-created
    row gets ``public_agent_view``.
    """
    if entitled or not is_user_created(row):
        return schemas.Agent.model_validate(row).model_dump(mode="json")
    return public_agent_view(row)
