"""Identity claims and model ceilings do not trust the caller's request body."""

from unittest.mock import Mock

import pytest

from chat_access import ChatAccessError, ChatPrincipal, cap_chat_tier, resolve_chat_principal


def resolve(**overrides):
    arguments = dict(
        api_key=None, service_token=None, claimed_user_id=None,
        service_secret="test-service-secret", resolve_key=Mock(),
        unlinked_dev_key="dev-desktop-token",
    )
    arguments.update(overrides)
    return resolve_chat_principal(**arguments)


def test_anonymous_has_no_user_or_key_authority():
    principal = resolve()
    assert principal == ChatPrincipal()
    assert principal.session_owner == "anonymous"


@pytest.mark.parametrize("token", [None, "dev-desktop-token"])
def test_anonymous_cannot_assert_a_user(token):
    with pytest.raises(ChatAccessError) as error:
        resolve(api_key=token, claimed_user_id="someone-else")
    assert error.value.status_code == 401


def test_verified_key_derives_its_owner():
    resolver = Mock(return_value=("key-a", "user-a", "alchemist"))
    principal = resolve(api_key="credential-a", resolve_key=resolver)
    assert principal.user_id == "user-a"
    assert principal.session_owner == "user:user-a"
    resolver.assert_called_once_with("credential-a")


def test_verified_key_cannot_assert_another_user():
    with pytest.raises(ChatAccessError) as error:
        resolve(api_key="credential-a", claimed_user_id="user-b", resolve_key=Mock(return_value=("key-a", "user-a", "alchemist")))
    assert error.value.status_code == 403


@pytest.mark.parametrize("identity", [(None, None, "anonymous"), (None, "user-a", "alchemist"), ("key-a", "user-a", "invalid")])
def test_invalid_or_expired_credentials_are_rejected(identity):
    with pytest.raises(ChatAccessError) as error:
        resolve(api_key="expired", resolve_key=Mock(return_value=identity))
    assert error.value.status_code == 401


@pytest.mark.parametrize("field", ["api_key", "service_token"])
def test_verified_service_may_forward_authenticated_user(field):
    resolver = Mock()
    principal = resolve(**{field: "test-service-secret"}, claimed_user_id="verified-user", resolve_key=resolver)
    assert principal.trusted_service is True
    assert principal.session_owner == "user:verified-user"
    resolver.assert_not_called()


def test_invalid_service_credential_cannot_fall_back_to_anonymous():
    with pytest.raises(ChatAccessError) as error:
        resolve(service_token="wrong-service-secret")
    assert error.value.status_code == 401


def test_key_without_user_gets_key_scoped_sessions():
    principal = resolve(api_key="operator", resolve_key=Mock(return_value=("env-master-key", None, "alchemist")))
    assert principal.session_owner == "key:env-master-key"


@pytest.mark.parametrize(
    ("tier", "expected"),
    [("anonymous", "free"), ("standard", "cheap_fast"), ("alchemist", "reflective"), ("invalid", "free")],
)
def test_requested_tier_is_capped_by_verified_entitlement(tier, expected):
    assert cap_chat_tier("reflective", ChatPrincipal(auth_tier=tier)) == expected


@pytest.mark.parametrize("requested", [None, "invalid", "", "free"])
def test_unknown_model_tier_fails_to_free(requested):
    assert cap_chat_tier(requested, ChatPrincipal(auth_tier="alchemist")) == "free"
