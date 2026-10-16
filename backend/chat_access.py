"""Verified chat principals and model ceilings, independent of the HTTP framework."""

from dataclasses import dataclass
from typing import Callable, Optional, Tuple

from secure_compare import secret_matches


class ChatAccessError(ValueError):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ChatPrincipal:
    api_key_id: Optional[str] = None
    user_id: Optional[str] = None
    auth_tier: str = "anonymous"
    trusted_service: bool = False

    @property
    def session_owner(self) -> str:
        if self.user_id:
            return f"user:{self.user_id}"
        if self.api_key_id:
            return f"key:{self.api_key_id}"
        return "service" if self.trusted_service else "anonymous"


def resolve_chat_principal(
    *,
    api_key: Optional[str],
    service_token: Optional[str],
    claimed_user_id: Optional[str],
    service_secret: Optional[str],
    resolve_key: Callable[[str], Tuple[Optional[str], Optional[str], str]],
    unlinked_dev_key: Optional[str] = None,
) -> ChatPrincipal:
    """Only a verified service may assert an actor; API keys derive their owner."""
    if service_token:
        if not secret_matches(service_token, service_secret):
            raise ChatAccessError(401, "Invalid service credential")
        return ChatPrincipal(user_id=claimed_user_id, auth_tier="alchemist", trusted_service=True)

    # Accept the existing service bearer convention as well as its named header.
    if secret_matches(api_key, service_secret):
        return ChatPrincipal(user_id=claimed_user_id, auth_tier="alchemist", trusted_service=True)

    if api_key and not secret_matches(api_key, unlinked_dev_key):
        key_id, user_id, tier = resolve_key(api_key)
        if not key_id or tier not in {"standard", "alchemist"}:
            raise ChatAccessError(401, "Invalid or expired API key")
        if claimed_user_id and claimed_user_id != user_id:
            raise ChatAccessError(403, "The supplied user does not own this credential")
        return ChatPrincipal(api_key_id=key_id, user_id=user_id, auth_tier=tier)

    if claimed_user_id:
        raise ChatAccessError(401, "A verified credential is required to identify a user")
    return ChatPrincipal()


def cap_chat_tier(requested: Optional[str], principal: ChatPrincipal) -> str:
    tiers = ("free", "cheap_fast", "primary", "reflective")
    requested = requested if requested in tiers else "free"
    ceiling = {"anonymous": 0, "standard": 1, "alchemist": 3}.get(principal.auth_tier, 0)
    return tiers[min(tiers.index(requested), ceiling)]
