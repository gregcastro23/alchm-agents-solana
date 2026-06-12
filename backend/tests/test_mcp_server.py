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

