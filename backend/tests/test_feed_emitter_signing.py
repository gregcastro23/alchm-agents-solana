import json
import logging
import pytest
import httpx
import feed_emitter
from feed_emitter import (
    parse_webhook_secret,
    compute_v1_signature,
    _post_feed_event,
    __reset_warned_missing_hook_secret,
)


def test_standard_webhooks_golden_vector():
    secret_raw = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw="
    msg_id = "msg_p5jXN8AQM9LWM0D4loKWxJek"
    timestamp = 1614265330
    body_bytes = b'{"test": 2432232314}'

    secret_key = parse_webhook_secret(secret_raw)
    assert len(secret_key) == 24

    sig = compute_v1_signature(msg_id, timestamp, body_bytes, secret_key)
    assert sig == "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="


def test_parse_webhook_secret_variants():
    # With prefix
    key1 = parse_webhook_secret("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw=")
    assert len(key1) == 24

    # Without prefix
    key2 = parse_webhook_secret("MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw=")
    assert key1 == key2

    # Whitespace trimming
    key3 = parse_webhook_secret("  whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw=  \n")
    assert key1 == key3

    # Empty
    with pytest.raises(ValueError, match="Webhook secret cannot be empty"):
        parse_webhook_secret("")
    with pytest.raises(ValueError, match="Webhook secret cannot be empty"):
        parse_webhook_secret("   ")

    # Prefix only
    with pytest.raises(ValueError, match="after stripping whsec_ prefix"):
        parse_webhook_secret("whsec_")


@pytest.mark.asyncio
async def test_post_feed_event_signing_wire_integrity(monkeypatch):
    """Verify exact bytes sent on wire match signed bytes with Standard Webhooks headers."""
    secret_raw = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw="
    monkeypatch.setenv("HOOK_SECRET_ASOL", secret_raw)
    monkeypatch.setattr(feed_emitter, "INTERNAL_API_SECRET", "test_internal_secret")

    captured_requests = []

    def mock_handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(mock_handler)
    real_async_client = httpx.AsyncClient

    def mock_client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", mock_client_factory)

    metadata = {"message": "hello alchemical world", "topic": "hermetics"}
    await _post_feed_event("monica-001@agentic.alchm.kitchen", "agent_chat", metadata)

    assert len(captured_requests) == 1
    req = captured_requests[0]

    # Verify Standard Webhooks headers
    assert "webhook-id" in req.headers
    assert "webhook-timestamp" in req.headers
    assert "webhook-signature" in req.headers

    msg_id = req.headers["webhook-id"]
    timestamp = int(req.headers["webhook-timestamp"])
    sig = req.headers["webhook-signature"]

    # Verify signature independently against wire bytes
    secret_key = parse_webhook_secret(secret_raw)
    expected_sig = compute_v1_signature(msg_id, timestamp, req.content, secret_key)
    assert sig == expected_sig

    # Verify Idempotency-Key matches webhook-id
    assert req.headers["Idempotency-Key"] == msg_id

    # Verify body is valid JSON matching payload
    body_data = json.loads(req.content.decode("utf-8"))
    assert body_data["agentEmail"] == "monica-001@agentic.alchm.kitchen"
    assert body_data["eventType"] == "agent_chat"
    assert body_data["idempotencyKey"] == msg_id


@pytest.mark.asyncio
async def test_post_feed_event_unsigned_when_secret_unset(monkeypatch, caplog):
    """Verify that when HOOK_SECRET_ASOL is unset, events are sent unsigned and a warning is logged once."""
    monkeypatch.setenv("HOOK_SECRET_ASOL", "")
    monkeypatch.setattr(feed_emitter, "INTERNAL_API_SECRET", "test_internal_secret")
    __reset_warned_missing_hook_secret()

    captured_requests = []

    def mock_handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(mock_handler)
    real_async_client = httpx.AsyncClient

    def mock_client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", mock_client_factory)

    with caplog.at_level(logging.WARNING):
        await _post_feed_event("monica-001", "agent_chat", {"test": 1})
        await _post_feed_event("monica-001", "agent_chat", {"test": 2})

    assert len(captured_requests) == 2
    for req in captured_requests:
        assert "webhook-id" not in req.headers
        assert "webhook-timestamp" not in req.headers
        assert "webhook-signature" not in req.headers

    # Check warning was logged once
    warnings = [r.message for r in caplog.records if "HOOK_SECRET_ASOL is not set" in r.message]
    assert len(warnings) == 1
