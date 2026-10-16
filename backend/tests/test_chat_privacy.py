"""Chat feed visibility must follow explicit publication consent."""

import pytest

from chat_privacy import should_publish_chat


@pytest.mark.parametrize(
    "context",
    [
        {"visibility": "public"},
        {"visibility": "public", "isPrivate": False},
        {"visibility": "public", "isPrivate": False, "source": "web"},
    ],
)
def test_explicit_public_conversations_can_publish(context):
    assert should_publish_chat(context) is True


@pytest.mark.parametrize(
    "context",
    [
        None,
        {},
        {"source": "mcp"},
        {"isPrivate": False},
        {"isPrivate": True},
        {"visibility": "private"},
        {"visibility": "private", "isPrivate": False},
        {"visibility": "public", "isPrivate": True},
    ],
)
def test_private_and_unspecified_conversations_do_not_publish(context):
    assert should_publish_chat(context) is False


@pytest.mark.parametrize(
    "visibility",
    [None, "", "Public", "PUBLIC", " public ", "unlisted", True, 1, [], {}],
)
def test_unknown_or_malformed_visibility_does_not_publish(visibility):
    assert should_publish_chat({"visibility": visibility}) is False


@pytest.mark.parametrize("private_flag", [None, "false", "true", "", 0, 1, [], {}])
def test_malformed_private_flag_does_not_publish(private_flag):
    assert (
        should_publish_chat({"visibility": "public", "isPrivate": private_flag})
        is False
    )


@pytest.mark.parametrize("context", ["public", [], ["visibility", "public"], 1, True])
def test_malformed_context_does_not_publish(context):
    assert should_publish_chat(context) is False
