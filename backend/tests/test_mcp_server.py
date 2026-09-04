import json
import pytest
from unittest.mock import AsyncMock

import planetary_agents_mcp_server
import mcp_invocation_log

@pytest.mark.asyncio
async def test_chat_with_planetary_agent_happy_path(monkeypatch):
    async def fake_backend_chat(agent_name, message, conversation_history=None, context=None, model_tier=None, sky_state=None):
        return {
            "agentName": agent_name,
            "agentId": "socrates",
            "text": "Hello seeker.",
            "sessionId": "mcp-socrates"
        }
        
    monkeypatch.setattr(planetary_agents_mcp_server, "_backend_chat", fake_backend_chat)
    monkeypatch.setattr(planetary_agents_mcp_server, "_live_sky_context", AsyncMock(return_value={"dominantElement": "Air"}))

    response = await planetary_agents_mcp_server.chat_with_planetary_agent({
        "agentName": "Socrates",
        "message": "What is truth?"
    })

    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["agentName"] == "Socrates"
    assert payload["text"] == "Hello seeker."
    assert payload["liveSkyState"]["dominantElement"] == "Air"


@pytest.mark.asyncio
async def test_chat_with_planetary_agent_missing_arguments():
    response = await planetary_agents_mcp_server.chat_with_planetary_agent({
        "message": "hello"
    })
    assert response.get("isError") is True
    payload = json.loads(response["content"][0]["text"])
    assert "error" in payload
    assert "required" in payload["error"]


@pytest.mark.asyncio
async def test_chat_with_planetary_agent_backend_500(monkeypatch):
    async def fake_backend_chat(*args, **kwargs):
        raise RuntimeError("Backend exploded")
        
    monkeypatch.setattr(planetary_agents_mcp_server, "_backend_chat", fake_backend_chat)
    monkeypatch.setattr(planetary_agents_mcp_server, "_live_sky_context", AsyncMock(return_value=None))

    response = await planetary_agents_mcp_server.chat_with_planetary_agent({
        "agentName": "Socrates",
        "message": "What is truth?"
    })

    assert response.get("isError") is True
    payload = json.loads(response["content"][0]["text"])
    assert "exploded" in payload["message"]


@pytest.mark.asyncio
async def test_get_agent_feed_discussion_not_found(monkeypatch):
    # Mock frontend call returning empty events
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"events": []}
        def raise_for_status(self):
            pass

    async def fake_get(url, *args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    response = await planetary_agents_mcp_server.get_agent_feed_discussion({
        "threadId": "non-existent-id"
    })

    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["found"] is False
    assert payload["threadId"] == "non-existent-id"


@pytest.mark.asyncio
async def test_get_agent_feed_discussion_frontend_500(monkeypatch):
    async def fake_get(url, *args, **kwargs):
        raise RuntimeError("Network down")

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    response = await planetary_agents_mcp_server.get_agent_feed_discussion({
        "threadId": "some-id"
    })

    assert response.get("isError") is True
    payload = json.loads(response["content"][0]["text"])
    assert "failed" in payload["error"]


@pytest.mark.asyncio
async def test_synthesize_culinary_debate_happy_path(monkeypatch):
    async def fake_alchemize(ingredients):
        return {"dominantElement": "Fire", "ingredientCount": len(ingredients)}

    async def fake_recipe(prompt, dominant_element=None, cuisine=None, dietary=None):
        return {"recipes": [{"name": "Fiery Soup"}]}

    async def fake_backend_chat(agent_name, message, conversation_history=None, context=None, model_tier=None, sky_state=None):
        return {
            "agentName": agent_name,
            "agentId": planetary_agents_mcp_server._agent_id(agent_name),
            "text": f"{agent_name} Stance text"
        }

    monkeypatch.setattr(planetary_agents_mcp_server.alchm_mcp, "alchemize_ingredients", fake_alchemize)
    monkeypatch.setattr(planetary_agents_mcp_server.alchm_mcp, "generate_cosmic_recipe", fake_recipe)
    monkeypatch.setattr(planetary_agents_mcp_server, "_backend_chat", fake_backend_chat)
    monkeypatch.setattr(planetary_agents_mcp_server, "_live_sky_context", AsyncMock(return_value={"dominantElement": "Fire"}))

    response = await planetary_agents_mcp_server.synthesize_culinary_debate({
        "ingredients": ["chili", "pepper"],
        "agents": ["Socrates", "Rumi"]
    })

    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["alchemicalScan"]["dominantElement"] == "Fire"
    assert payload["recipeCandidates"]["recipes"][0]["name"] == "Fiery Soup"
    assert len(payload["dialogue"]) == 2
    assert payload["dialogue"][0]["text"] == "Socrates Stance text"


@pytest.mark.asyncio
async def test_tier_gating_anonymous(monkeypatch):
    # Mock out DB resolution for validate_and_gate_invocation to return "anonymous"
    monkeypatch.setattr(mcp_invocation_log, "resolve_api_key_sync", lambda db, key: (None, None, "anonymous"))

    # Test that chat_with_planetary_agent requested with primary modelTier gets downgraded to free
    gated_args, api_key_id, user_id, auth_tier, resolved_model_tier = mcp_invocation_log.validate_and_gate_invocation(
        "chat_with_planetary_agent",
        {
            "agentName": "Socrates",
            "message": "ping",
            "modelTier": "primary",
            "_meta": {
                "apiKey": None
            }
        }
    )

    assert auth_tier == "anonymous"
    assert resolved_model_tier == "free"
    assert gated_args["modelTier"] == "free"

    # Test that debate requested with 3 agents gets capped to 1 agent for anonymous
    gated_args_debate, _, _, _, _ = mcp_invocation_log.validate_and_gate_invocation(
        "synthesize_culinary_debate",
        {
            "ingredients": ["apple"],
            "agents": ["Socrates", "Rumi", "Galileo"],
            "_meta": {
                "apiKey": None
            }
        }
    )
    assert len(gated_args_debate["agents"]) == 1
    assert gated_args_debate["agents"][0] == "Socrates"


@pytest.mark.asyncio
async def test_tier_gating_standard_key(monkeypatch):
    # Mock standard active key
    monkeypatch.setattr(mcp_invocation_log, "resolve_api_key_sync", lambda db, key: ("some-key-id", "some-user-id", "standard"))

    # Test that standard key gets primary modelTier downgraded to cheap_fast
    gated_args, api_key_id, user_id, auth_tier, resolved_model_tier = mcp_invocation_log.validate_and_gate_invocation(
        "chat_with_planetary_agent",
        {
            "agentName": "Socrates",
            "message": "ping",
            "modelTier": "primary",
            "_meta": {
                "apiKey": "valid-standard-key"
            }
        }
    )

    assert auth_tier == "standard"
    assert resolved_model_tier == "cheap_fast"
    assert gated_args["modelTier"] == "cheap_fast"

    # Test that debate is also capped to 1 agent
    gated_args_debate, _, _, _, _ = mcp_invocation_log.validate_and_gate_invocation(
        "synthesize_culinary_debate",
        {
            "ingredients": ["apple"],
            "agents": ["Socrates", "Rumi", "Galileo"],
            "_meta": {
                "apiKey": "valid-standard-key"
            }
        }
    )
    assert len(gated_args_debate["agents"]) == 1


@pytest.mark.asyncio
async def test_tier_gating_alchemist_key(monkeypatch):
    # Mock premium/alchemist key
    monkeypatch.setattr(mcp_invocation_log, "resolve_api_key_sync", lambda db, key: ("premium-key-id", "premium-user-id", "alchemist"))

    # Test that premium key retains reflective/primary tier and full debate
    gated_args, api_key_id, user_id, auth_tier, resolved_model_tier = mcp_invocation_log.validate_and_gate_invocation(
        "chat_with_planetary_agent",
        {
            "agentName": "Socrates",
            "message": "ping",
            "modelTier": "reflective",
            "_meta": {
                "apiKey": "valid-premium-key"
            }
        }
    )

    assert auth_tier == "alchemist"
    assert resolved_model_tier == "reflective"
    assert gated_args["modelTier"] == "reflective"

    gated_args_debate, _, _, _, _ = mcp_invocation_log.validate_and_gate_invocation(
        "synthesize_culinary_debate",
        {
            "ingredients": ["apple"],
            "agents": ["Socrates", "Rumi", "Galileo"],
            "_meta": {
                "apiKey": "valid-premium-key"
            }
        }
    )
    assert len(gated_args_debate["agents"]) == 3


@pytest.mark.asyncio
async def test_trigger_chart_specific_jing_duel(monkeypatch):
    # Mock database retrieval of natal charts
    def fake_get_natal_chart(agent_name):
        return {"planets": {"Sun": {"longitude": 45}}}

    # Mock synastry calculation tool
    async def fake_synastry(*args, **kwargs):
        return {
            "interchartAspects": [
                {
                    "type": "conjunction",
                    "planetA": "Sun",
                    "planetB": "Sun",
                    "orb": 1.5,
                    "harmonic": "friction"
                }
            ],
            "scores": {"tension": 85, "harmony": 15, "intensification": 50, "aspectCount": 1}
        }

    # Mock backend chat response
    async def fake_backend_chat(agent_name, message, conversation_history=None, context=None, model_tier=None, sky_state=None):
        return {
            "agentName": agent_name,
            "agentId": planetary_agents_mcp_server._agent_id(agent_name),
            "text": f"{agent_name} responding to the Jing clash."
        }

    monkeypatch.setattr(planetary_agents_mcp_server, "_get_agent_natal_chart", fake_get_natal_chart)
    monkeypatch.setattr(planetary_agents_mcp_server.alchm_mcp, "compute_synastry_overlay", fake_synastry)
    monkeypatch.setattr(planetary_agents_mcp_server, "_backend_chat", fake_backend_chat)

    response = await planetary_agents_mcp_server.trigger_chart_specific_jing_duel({
        "casterName": "Socrates",
        "targetName": "Rumi",
        "modelTier": "free"
    })

    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["triggered"] is True
    assert payload["moveId"] == "meltdown"  # harmonic 'friction' maps to Meltdown
    assert payload["caster"] == "Socrates"
    assert payload["target"] == "Rumi"
    assert "Socrates responding" in payload["casterVoice"]
    assert "Rumi responding" in payload["targetVoice"]


@pytest.mark.asyncio
async def test_list_planetary_agents_happy_path(monkeypatch):
    class FakeResponse:
        status_code = 200
        def json(self):
            return [
                {
                    "agentId": "socrates",
                    "name": "Socrates",
                    "title": "The Gadfly of Athens",
                    "historicalEra": "Classical Greece",
                    "culture": "Greek",
                    "consciousnessLevel": 95,
                    "dominantElement": "Air"
                },
                {
                    "agentId": "planetary-moon-aries-14",
                    "name": "Waxing Crescent Moon in Aries 14 Degree",
                    "title": "The Young Explorer",
                    "historicalEra": "Cosmic Degree",
                    "culture": "Universal",
                    "consciousnessLevel": 100,
                    "dominantElement": "Fire"
                }
            ]
        def raise_for_status(self):
            pass

    async def fake_get(url, *args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    response = await planetary_agents_mcp_server.list_planetary_agents({"limit": 10})
    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["success"] is True
    assert payload["count"] == 2
    assert payload["agents"][0]["agentId"] == "socrates"
    assert payload["agents"][1]["agentId"] == "planetary-moon-aries-14"


@pytest.mark.asyncio
async def test_list_planetary_agents_with_query(monkeypatch):
    class FakeResponse:
        status_code = 200
        def json(self):
            return {
                "query": "Socrates",
                "count": 1,
                "agents": [
                    {
                        "agentId": "socrates",
                        "name": "Socrates",
                        "title": "The Gadfly of Athens",
                        "historicalEra": "Classical Greece",
                        "culture": "Greek",
                        "consciousnessLevel": 95
                    }
                ]
            }
        def raise_for_status(self):
            pass

    async def fake_get(url, *args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    response = await planetary_agents_mcp_server.list_planetary_agents({"query": "Socrates"})
    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["success"] is True
    assert payload["count"] == 1
    assert payload["agents"][0]["name"] == "Socrates"


@pytest.mark.asyncio
async def test_play_agent_word_duel(monkeypatch):
    class FakeResponse:
        status_code = 200
        def json(self):
            return {
                "success": True,
                "agentKey": "galileo-galilei",
                "planet": "Jupiter",
                "move": {
                    "word": "SATURN",
                    "score": 24,
                    "rationale": "The celestial spheres turn in mathematical precision."
                }
            }
        def raise_for_status(self):
            pass

    async def fake_post(url, *args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    response = await planetary_agents_mcp_server.play_agent_word_duel({
        "agentName": "Galileo",
        "rack": "SATURNX",
        "candidates": ["SATURN", "STAR", "SUN"]
    })

    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["success"] is True
    assert payload["move"]["word"] == "SATURN"
    assert "mathematical precision" in payload["move"]["rationale"]


@pytest.mark.asyncio
async def test_play_jing_arena_move(monkeypatch):
    class FakeResponse:
        status_code = 200
        def json(self):
            return {
                "success": True,
                "planet": "Moon",
                "move": "Freeze",
                "element": "Water",
                "voice": "The cool waters extinguish the heat of contention."
            }
        def raise_for_status(self):
            pass

    async def fake_post(url, *args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    response = await planetary_agents_mcp_server.play_jing_arena_move({
        "planet": "Moon",
        "opening": "Meltdown",
        "agentName": "Hypatia"
    })

    assert "isError" not in response
    payload = json.loads(response["content"][0]["text"])
    assert payload["success"] is True
    assert payload["move"] == "Freeze"
    assert payload["element"] == "Water"


@pytest.mark.asyncio
async def test_mcp_resources_protocol(monkeypatch):
    # Test resources/list
    res_list = await planetary_agents_mcp_server.handle_request({
        "jsonrpc": "2.0",
        "id": "test-res-list",
        "method": "resources/list"
    })
    assert res_list["result"]["resources"]
    uris = [r["uri"] for r in res_list["result"]["resources"]]
    assert "resource://sky/transits" in uris
    assert "resource://agents/catalog" in uris
    assert "resource://game/jing-counters" in uris

    # Test resources/read for catalog
    res_read_cat = await planetary_agents_mcp_server.handle_request({
        "jsonrpc": "2.0",
        "id": "test-res-read-cat",
        "method": "resources/read",
        "params": {"uri": "resource://agents/catalog"}
    })
    cat_text = res_read_cat["result"]["contents"][0]["text"]
    cat_json = json.loads(cat_text)
    assert "craftedPersonas" in cat_json
    assert cat_json["moonDegreeArchetypes"]["count"] == 360

    # Test resources/read for jing-counters
    res_read_jing = await planetary_agents_mcp_server.handle_request({
        "jsonrpc": "2.0",
        "id": "test-res-read-jing",
        "method": "resources/read",
        "params": {"uri": "resource://game/jing-counters"}
    })
    jing_text = res_read_jing["result"]["contents"][0]["text"]
    jing_json = json.loads(jing_text)
    assert "Meltdown" in jing_json["moves"]
    assert jing_json["moves"]["Meltdown"]["counters"] == "TectonicRoot"


@pytest.mark.asyncio
async def test_mcp_prompts_protocol():
    # Test prompts/list
    prompts_list = await planetary_agents_mcp_server.handle_request({
        "jsonrpc": "2.0",
        "id": "test-prompts-list",
        "method": "prompts/list"
    })
    assert prompts_list["result"]["prompts"]
    names = [p["name"] for p in prompts_list["result"]["prompts"]]
    assert "culinary-debate" in names
    assert "philosophical-council" in names
    assert "jing-elemental-clash" in names

    # Test prompts/get culinary-debate
    prompt_get = await planetary_agents_mcp_server.handle_request({
        "jsonrpc": "2.0",
        "id": "test-prompts-get",
        "method": "prompts/get",
        "params": {
            "name": "culinary-debate",
            "arguments": {"ingredients": "cardamom, saffron", "agents": "Rumi, Socrates"}
        }
    })
    messages = prompt_get["result"]["messages"]
    assert "cardamom, saffron" in messages[0]["content"]["text"]
    assert "Rumi, Socrates" in messages[0]["content"]["text"]


def test_calculate_lunar_phase():
    # Sun 0, Moon 0 -> New Moon
    new_moon = planetary_agents_mcp_server._calculate_lunar_phase(0.0, 5.0)
    assert new_moon["phase"] == "New Moon"
    assert new_moon["symbol"] == "🌑"

    # Sun 0, Moon 90 -> First Quarter
    first_q = planetary_agents_mcp_server._calculate_lunar_phase(0.0, 90.0)
    assert first_q["phase"] == "First Quarter"
    assert first_q["symbol"] == "🌓"

    # Sun 0, Moon 180 -> Full Moon
    full_moon = planetary_agents_mcp_server._calculate_lunar_phase(0.0, 185.0)
    assert full_moon["phase"] == "Full Moon"
    assert full_moon["symbol"] == "🌕"


