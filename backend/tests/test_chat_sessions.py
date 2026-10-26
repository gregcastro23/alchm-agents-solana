import re

import pytest

from chat_sessions import scoped_session_id


SECRET = "test-only-internal-signing-secret"


def session(agent="socrates", owner="user:alice", handle=None, secret=SECRET):
    return scoped_session_id(agent, owner, handle, secret)


def test_missing_handle_creates_unguessable_conversations():
    first = session()
    second = session()

    assert re.fullmatch(r"pa1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}", first)
    assert first != second
    assert session(handle=first) == first


def test_authenticated_client_handle_resumes_only_for_same_owner_and_agent():
    first = session(handle="desktop-conversation-1")

    assert session(handle="desktop-conversation-1") == first
    assert session(owner="user:bob", handle="desktop-conversation-1") != first
    assert session(agent="rumi", handle="desktop-conversation-1") != first
    assert session(handle="desktop-conversation-2") != first
    assert session(owner="env-master-key", handle="desktop-conversation-1") != first


@pytest.mark.parametrize("raw_handle", [None, "", "mcp-socrates", "desktop-conversation-1"])
def test_anonymous_raw_handles_create_fresh_sessions(raw_handle):
    assert session(owner="anonymous", handle=raw_handle) != session(
        owner="anonymous", handle=raw_handle
    )


def test_anonymous_signed_handle_is_a_resumable_bearer_capability():
    handle = session(owner="anonymous", handle="mcp-socrates")

    assert session(owner="anonymous", handle=handle) == handle
    with pytest.raises(ValueError):
        session(owner="user:alice", handle=handle)


@pytest.mark.parametrize("other_owner", ["user:bob", "anonymous", "env-master-key"])
def test_signed_session_rejects_other_verified_owners(other_owner):
    handle = session()

    with pytest.raises(ValueError, match="caller or agent"):
        session(owner=other_owner, handle=handle)


def test_signed_session_rejects_other_agents_and_rotated_secret():
    handle = session()

    with pytest.raises(ValueError):
        session(agent="rumi", handle=handle)
    with pytest.raises(ValueError):
        session(handle=handle, secret="a-different-signing-secret")


@pytest.mark.parametrize("part_index", [1, 2])
def test_signed_session_rejects_tampered_nonce_or_signature(part_index):
    parts = session().split(".")
    part = parts[part_index]
    parts[part_index] = ("A" if part[0] != "A" else "B") + part[1:]

    with pytest.raises(ValueError):
        session(handle=".".join(parts))


@pytest.mark.parametrize(
    "handle",
    [
        "pa1",
        "pa1.",
        "pa1.nonce.signature",
        "pa1." + "a" * 43 + "." + "b" * 42,
        "pa1." + "a" * 43 + "." + "b" * 43 + ".extra",
        "pa1." + "/" * 43 + "." + "b" * 43,
        "pa1." + "a" * 43 + "." + "b" * 43 + "\n",
    ],
)
def test_malformed_signed_handles_are_not_treated_as_legacy_ids(handle):
    with pytest.raises(ValueError, match="Invalid signed"):
        session(handle=handle)


def test_raw_session_handle_length_boundary():
    assert session(handle="x" * 512) == session(handle="x" * 512)

    with pytest.raises(ValueError, match="512"):
        session(handle="x" * 513)


@pytest.mark.parametrize("handle", [42, {}, []])
def test_non_string_handles_are_rejected(handle):
    with pytest.raises(ValueError, match="string"):
        session(handle=handle)


@pytest.mark.parametrize("value", [None, "", "  "])
@pytest.mark.parametrize("field", ["agent", "owner", "secret"])
def test_scoping_fields_and_signing_secret_must_be_nonempty_strings(field, value):
    with pytest.raises(ValueError, match="nonempty"):
        session(**{field: value})


def test_scoping_uses_unambiguous_encoding_for_delimiters_and_unicode():
    handle = session(agent="a:b", owner="user:🌙", handle="c:d")

    assert handle != session(agent="b", owner="user:🌙:a", handle="c:d")
    assert session(agent="a:b", owner="user:🌙", handle=handle) == handle
    with pytest.raises(ValueError):
        session(agent="b", owner="user:🌙:a", handle=handle)
