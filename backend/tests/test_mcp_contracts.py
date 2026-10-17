"""Offline boundary checks for the advertised MCP business contracts."""

import copy

import pytest

from mcp_contracts import (
    ContractValidationError,
    TOOL_NAMES,
    tool_schemas,
    validate_arguments,
    validate_result,
)


def menu():
    return {
        "agentSlug": "socrates",
        "agentDisplayName": "Socrates",
        "weekStartDate": "2026-10-18T00:00:00.000Z",
        "status": "draft",
        "shareToFeed": False,
        "title": "A considered week",
        "summary": "A complete draft for review.",
        "meals": [
            {
                "id": f"{day}-{kind}",
                "dayOfWeek": day,
                "mealType": kind,
                "servings": 2,
                "recipe": {"id": "lentil-soup", "name": "Lentil soup"},
            }
            for day in range(7)
            for kind in ("breakfast", "lunch", "dinner", "snack")
        ],
        "nutritionalTotals": {"calories": 12000},
        "planetarySignature": {"dominantElement": "Air"},
    }


def chat():
    return {"agentName": "Socrates", "agentId": "socrates", "text": "Let us examine this.", "sessionId": "pa1.test"}


VALID_ARGUMENTS = [
    ("chat_with_planetary_agent", {"agentName": "Socrates", "message": "What is virtue?", "context": {"visibility": "private"}}),
    ("list_planetary_agents", {"limit": 25, "query": "Socrates"}),
    ("get_agent_feed_discussion", {"threadId": "event-1"}),
    ("synthesize_culinary_debate", {"ingredients": ["lentils"], "agents": ["Socrates", "Rumi"]}),
    ("trigger_chart_specific_jing_duel", {"casterName": "Socrates", "targetName": "Rumi", "modelTier": "free"}),
    ("play_agent_word_duel", {"agentName": "Socrates", "rack": "SATURNX", "candidates": ["SATURN", "STAR"]}),
    ("play_jing_arena_move", {"planet": "Moon", "opening": "Meltdown", "agentName": "Rumi"}),
    ("plan_weekly_menu", {"agentName": "Socrates", "status": "draft", "shareToFeed": False}),
    ("publish_weekly_menu", {"menu": menu(), "idempotencyKey": "menu-draft-1"}),
]


VALID_RESULTS = [
    ("chat_with_planetary_agent", chat()),
    ("list_planetary_agents", {"success": True, "count": 1, "agents": [{"agentId": "socrates", "name": "Socrates", "title": None}], "filters": {"query": None, "limit": 25, "sign": None, "archetype": None}}),
    ("get_agent_feed_discussion", {"threadId": "event-1", "found": True, "event": {"id": "event-1", "kind": "discussion"}, "thread": [{"text": "A reply"}]}),
    ("synthesize_culinary_debate", {"ingredients": ["lentils"], "agents": ["Socrates"], "alchemicalScan": {}, "recipeCandidates": {}, "liveSkyState": None, "triggeredJing": None, "dataErrors": [], "dialogue": [chat()]}),
    ("trigger_chart_specific_jing_duel", {"triggered": False, "reason": "No close aspect was found."}),
    ("play_agent_word_duel", {"success": True, "agentKey": "socrates", "planet": "Sun", "move": {"word": "SATURN", "rationale": "An orderly choice.", "score": 12, "source": "model", "latencyMs": 30}, "timestamp": "2026-10-16T12:00:00Z"}),
    ("play_jing_arena_move", {"success": True, "planet": "Moon", "move": "Freeze", "voice": "The water cools.", "element": "Water", "source": "counter", "timestamp": "2026-10-16T12:00:00Z"}),
    ("plan_weekly_menu", {"success": True, "message": "Generated unpublished draft.", "menu": menu(), "feedShared": False}),
    ("publish_weekly_menu", {"success": True, "menu": {"id": "saved-menu-1"}, "feedShared": True, "feedMetadata": {"id": "event-1"}}),
]


@pytest.mark.parametrize("name,payload", VALID_ARGUMENTS)
def test_all_nine_valid_requests_preserve_json(name, payload):
    original = copy.deepcopy(payload)
    assert validate_arguments(name, payload) == original
    assert payload == original


@pytest.mark.parametrize("name,payload", VALID_RESULTS)
def test_all_nine_success_results_preserve_json(name, payload):
    assert validate_result(name, payload) == payload


@pytest.mark.parametrize("name", sorted(TOOL_NAMES))
def test_all_schemas_have_object_roots_and_no_credentials(name):
    request, result = tool_schemas(name)
    assert request["type"] == result["type"] == "object"
    assert request["additionalProperties"] is False
    assert "_meta" not in request.get("properties", {})
    assert "apiKey" not in request.get("properties", {})
    assert "properties" in result or "anyOf" in result


@pytest.mark.parametrize("name,payload", [
    ("chat_with_planetary_agent", {"agentName": 17, "message": "hello"}),
    ("list_planetary_agents", {"limit": "25"}),
    ("get_agent_feed_discussion", {"threadId": []}),
    ("synthesize_culinary_debate", {"ingredients": "lentils"}),
    ("trigger_chart_specific_jing_duel", {"casterName": "Socrates", "targetName": False}),
    ("play_agent_word_duel", {"rack": "SATURN", "candidates": {"word": "SATURN"}}),
    ("play_jing_arena_move", {"planet": "Moon", "opening": "invalid"}),
    ("plan_weekly_menu", {"agentName": "Socrates", "shareToFeed": "false"}),
    ("publish_weekly_menu", {"menu": menu(), "idempotencyKey": 123}),
])
def test_wrong_types_are_rejected_for_all_nine_requests(name, payload):
    with pytest.raises(ContractValidationError):
        validate_arguments(name, payload)


@pytest.mark.parametrize("name,payload", [
    ("chat_with_planetary_agent", {"agentName": "Socrates", "message": "x" * 12001}),
    ("list_planetary_agents", {"query": "x" * 201}),
    ("get_agent_feed_discussion", {"threadId": "x" * 201}),
    ("synthesize_culinary_debate", {"ingredients": ["lentils"] * 65}),
    ("trigger_chart_specific_jing_duel", {"casterName": "x" * 201, "targetName": "Rumi"}),
    ("play_agent_word_duel", {"rack": "SATURN", "candidates": ["SATURN"] * 257}),
    ("play_jing_arena_move", {"planet": "Moon", "opening": "Meltdown", "agentName": "x" * 201}),
    ("plan_weekly_menu", {"agentName": "x" * 201}),
    ("publish_weekly_menu", {"menu": menu(), "idempotencyKey": "x" * 201}),
])
def test_oversize_requests_are_rejected_for_all_nine_tools(name, payload):
    with pytest.raises(ContractValidationError):
        validate_arguments(name, payload)


@pytest.mark.parametrize("name", sorted(TOOL_NAMES))
def test_successful_empty_upstream_payload_is_never_accepted(name):
    with pytest.raises(ContractValidationError):
        validate_result(name, {})


@pytest.mark.parametrize("name", sorted(TOOL_NAMES))
def test_error_contract_requires_explicit_error_flag(name):
    error = {"error": "Service unavailable", "message": "Try again later", "code": "upstream_unavailable"}
    assert validate_result(name, error, is_error=True) == error
    with pytest.raises(ContractValidationError):
        validate_result(name, error)
    with pytest.raises(ContractValidationError):
        validate_result(name, {"message": "Missing required error"}, is_error=True)


def test_errors_do_not_echo_private_prompt_or_unknown_property():
    secret = "private-secret-that-must-never-be-echoed"
    with pytest.raises(ContractValidationError) as caught:
        validate_arguments("chat_with_planetary_agent", {"agentName": [secret], "message": "hello", secret: True})
    assert secret not in str(caught.value)
    assert len(str(caught.value)) < 2000


@pytest.mark.parametrize("value", [0, 1, "false", "true", None])
def test_booleans_are_not_coerced(value):
    with pytest.raises(ContractValidationError):
        validate_arguments("plan_weekly_menu", {"agentName": "Socrates", "shareToFeed": value})
    bad = {"success": value, "menu": {"id": "saved"}}
    with pytest.raises(ContractValidationError):
        validate_result("publish_weekly_menu", bad)


@pytest.mark.parametrize("payload", [{"limit": True}, {"limit": 0}, {"limit": 101}, {"limit": 1.5}])
def test_discovery_limit_is_a_bounded_integer(payload):
    with pytest.raises(ContractValidationError):
        validate_arguments("list_planetary_agents", payload)


@pytest.mark.parametrize("field", ["agentName", "message"])
def test_required_chat_fields_cannot_be_blank(field):
    payload = {"agentName": "Socrates", "message": "Hello", field: "  "}
    with pytest.raises(ContractValidationError):
        validate_arguments("chat_with_planetary_agent", payload)


def test_known_game_persona_aliases_are_normalized():
    assert validate_arguments("play_agent_word_duel", {"agentId": "socrates", "rack": "SATURN", "candidates": ["SATURN"]})["agentName"] == "socrates"
    word = validate_arguments("play_agent_word_duel", {"planet": "Sun", "rack": "SATURN", "candidates": ["SATURN"]})
    assert word["agentName"] == "Sun"
    assert "planet" not in word
    jing = validate_arguments("play_jing_arena_move", {"planet": " moon ", "opening": "Meltdown", "agentId": "rumi"})
    assert jing == {"planet": "Moon", "opening": "Meltdown", "agentName": "rumi"}


def test_publication_exact_menu_is_not_changed_by_model_defaults_or_numbers():
    draft = menu()
    draft["weeklyBudget"] = None
    draft["meals"][0]["servings"] = 2
    payload = {"menu": draft, "idempotencyKey": "draft-1"}
    validated = validate_arguments("publish_weekly_menu", payload)
    assert validated == payload
    assert type(validated["menu"]["meals"][0]["servings"]) is int
    assert validated is not payload
    assert validated["menu"] is not draft
    assert "createdAt" not in validated["menu"]


@pytest.mark.parametrize("change", ["missing", "duplicate", "invalid_day", "boolean_servings"])
def test_menus_require_28_distinct_valid_slots(change):
    draft = menu()
    if change == "missing":
        draft["meals"].pop()
    elif change == "duplicate":
        draft["meals"][1] = copy.deepcopy(draft["meals"][0])
    elif change == "invalid_day":
        draft["meals"][0]["dayOfWeek"] = 7
    else:
        draft["meals"][0]["servings"] = True
    with pytest.raises(ContractValidationError):
        validate_arguments("publish_weekly_menu", {"menu": draft, "idempotencyKey": "draft-1"})


def test_planning_result_cannot_claim_a_published_menu():
    payload = {"success": True, "message": "Draft", "menu": menu(), "feedShared": False}
    payload["menu"]["status"] = "completed"
    with pytest.raises(ContractValidationError):
        validate_result("plan_weekly_menu", payload)


def test_empty_chat_and_missing_publication_id_are_malformed_success():
    with pytest.raises(ContractValidationError):
        validate_result("chat_with_planetary_agent", {**chat(), "text": ""})
    with pytest.raises(ContractValidationError):
        validate_result("publish_weekly_menu", {"success": True, "menu": {}})


def test_missing_feed_event_is_a_valid_typed_outcome():
    payload = {"threadId": "absent", "found": False, "availableEventIds": ["event-1", None]}
    assert validate_result("get_agent_feed_discussion", payload) == payload


def test_triggered_duel_has_typed_aspect_and_both_voices():
    payload = {
        "triggered": True,
        "caster": "Socrates", "casterId": "socrates", "target": "Rumi", "targetId": "rumi",
        "moveId": "meltdown", "moveName": "Meltdown", "element": "Fire",
        "aspect": {"type": "square", "planetA": "Sun", "planetB": "Mars", "orb": 1.5, "harmonic": "friction"},
        "description": "A close square", "scores": {"tension": 85},
        "casterVoice": "Let us examine the heat.", "targetVoice": "The heart answers.",
    }
    assert validate_result("trigger_chart_specific_jing_duel", payload) == payload
    del payload["targetVoice"]
    with pytest.raises(ContractValidationError):
        validate_result("trigger_chart_specific_jing_duel", payload)


def test_partial_debate_failure_remains_explicit_and_machine_readable():
    payload = copy.deepcopy(dict(VALID_RESULTS)["synthesize_culinary_debate"])
    payload["agents"].append("Rumi")
    payload["dialogue"].append({"agentName": "Rumi", "agentId": "rumi", "error": "Upstream timeout"})
    payload["dataErrors"] = ["Recipe data unavailable"]
    assert validate_result("synthesize_culinary_debate", payload) == payload


@pytest.mark.parametrize("source,word", [("fallback", "SATURN"), ("yield", "")])
def test_word_fallback_and_yield_are_valid_outcomes(source, word):
    payload = copy.deepcopy(dict(VALID_RESULTS)["play_agent_word_duel"])
    payload["move"].update(source=source, word=word, score=0)
    assert validate_result("play_agent_word_duel", payload) == payload


def test_result_extensions_are_preserved_and_bounded():
    payload = {**chat(), "provenance": {"snapshot": "v2", "cached": False}}
    assert validate_result("chat_with_planetary_agent", payload)["provenance"] == payload["provenance"]
    payload["provenance"] = {"huge": "x" * 20001}
    with pytest.raises(ContractValidationError):
        validate_result("chat_with_planetary_agent", payload)


def test_flexible_context_depth_non_json_and_non_finite_numbers_are_rejected():
    nested = {}
    for _ in range(22):
        nested = {"nested": nested}
    for context in (nested, {"value": object()}, {"value": float("nan")}):
        with pytest.raises(ContractValidationError):
            validate_arguments("chat_with_planetary_agent", {"agentName": "Socrates", "message": "hello", "context": context})


def test_schema_mutation_cannot_modify_later_discovery():
    first, _ = tool_schemas("chat_with_planetary_agent")
    first["properties"].clear()
    second, _ = tool_schemas("chat_with_planetary_agent")
    assert "agentName" in second["properties"]


def test_json_escape_sequences_are_safely_bounded_without_unicode_errors():
    payload = {"agentName": "Socrates", "message": "A JSON surrogate: \ud800"}
    with pytest.raises(ContractValidationError, match="string_unicode"):
        validate_arguments("chat_with_planetary_agent", payload)


def test_encoded_context_size_is_bounded_independently_of_field_lengths():
    payload = {"agentName": "Socrates", "message": "hello", "context": {str(i): "x" * 10000 for i in range(15)}}
    with pytest.raises(ContractValidationError, match="encoded size"):
        validate_arguments("chat_with_planetary_agent", payload)


def test_error_messages_are_bounded_and_typed():
    for error in ({"error": "x" * 2001}, {"error": "failure", "message": []}):
        with pytest.raises(ContractValidationError):
            validate_result("list_planetary_agents", error, is_error=True)


def test_unknown_tool_and_non_object_payloads_fail_safely():
    for value in (None, [], "invalid"):
        with pytest.raises(ContractValidationError):
            validate_arguments("list_planetary_agents", value)
    with pytest.raises(ContractValidationError, match="Unknown tool"):
        validate_arguments("unregistered", {})
