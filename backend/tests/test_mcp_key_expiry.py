"""Exercise key resolution against SQLite without importing configured databases."""

import importlib.util
import sys
import types
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from models import Base, DesktopApiKey, User, UserSubscription


NOW = datetime(2026, 10, 16, 12, 0)
PREVIOUS_USE = NOW - timedelta(days=1)


@pytest.fixture
def key_resolution(monkeypatch):
    """Load the resolver with no database.py/.env import or global DB overrides."""
    database_stub = types.ModuleType("database")

    def unexpected_session():
        raise AssertionError("Key resolution must use the supplied SQLite session")

    database_stub.SessionLocal = unexpected_session
    module_path = Path(__file__).resolve().parents[1] / "mcp_invocation_log.py"
    spec = importlib.util.spec_from_file_location("_mcp_key_expiry_under_test", module_path)
    module = importlib.util.module_from_spec(spec)
    with monkeypatch.context() as imports:
        imports.setitem(sys.modules, "database", database_stub)
        spec.loader.exec_module(module)

    class FixedDatetime(datetime):
        @classmethod
        def utcnow(cls):
            return NOW

    monkeypatch.setattr(module, "datetime", FixedDatetime)
    monkeypatch.setattr(module, "PA_USER_API_KEY", "test-master-key")

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[DesktopApiKey.__table__, User.__table__, UserSubscription.__table__],
    )
    try:
        with Session(engine) as db:
            yield module, db
    finally:
        engine.dispose()


def add_key(db, *, expires_at=None, active=True, user_id="missing-account"):
    key = DesktopApiKey(
        id="key-id",
        userId=user_id,
        token="test-desktop-key",
        isActive=active,
        expiresAt=expires_at,
        lastUsedAt=PREVIOUS_USE,
    )
    db.add(key)
    db.commit()
    return key


@pytest.mark.parametrize("expires_at", [None, NOW + timedelta(microseconds=1)])
def test_valid_key_records_usage_and_retains_standard_access(key_resolution, expires_at):
    resolver, db = key_resolution
    key = add_key(db, expires_at=expires_at)

    assert resolver.resolve_api_key_sync(db, key.token) == (
        "key-id", "missing-account", "standard"
    )
    db.refresh(key)
    assert key.lastUsedAt == NOW


@pytest.mark.parametrize(
    ("expires_at", "active"),
    [
        (NOW - timedelta(microseconds=1), True),
        (NOW, True),
        (None, False),
        (NOW + timedelta(days=1), False),
    ],
)
def test_expired_or_inactive_keys_fail_before_updating_usage(key_resolution, expires_at, active):
    resolver, db = key_resolution
    key = add_key(db, expires_at=expires_at, active=active)

    assert resolver.resolve_api_key_sync(db, key.token) == (None, None, "anonymous")
    db.refresh(key)
    assert key.lastUsedAt == PREVIOUS_USE


def test_account_holder_keeps_alchemist_entitlement_without_subscription(key_resolution):
    resolver, db = key_resolution
    db.add(User(id="account-holder", email="account@example.test", role="user"))
    key = add_key(db, user_id="account-holder", expires_at=NOW + timedelta(days=1))

    assert resolver.resolve_api_key_sync(db, key.token) == (
        "key-id", "account-holder", "alchemist"
    )


def test_legacy_paid_subscription_keeps_alchemist_entitlement(key_resolution):
    resolver, db = key_resolution
    db.add(UserSubscription(id="subscription", userId="missing-account", tier="premium", status="active"))
    key = add_key(db)

    assert resolver.resolve_api_key_sync(db, key.token) == (
        "key-id", "missing-account", "alchemist"
    )


@pytest.mark.parametrize("api_key", [None, "", "unrecognized-key"])
def test_missing_or_unknown_keys_are_anonymous(key_resolution, api_key):
    resolver, db = key_resolution
    key = add_key(db)

    assert resolver.resolve_api_key_sync(db, api_key) == (None, None, "anonymous")
    db.refresh(key)
    assert key.lastUsedAt == PREVIOUS_USE


def test_master_key_uses_configured_path_without_database_lookup(key_resolution, monkeypatch):
    resolver, db = key_resolution

    def unexpected_query(*args, **kwargs):
        raise AssertionError("Master key must not require database availability")

    monkeypatch.setattr(db, "execute", unexpected_query)

    assert resolver.resolve_api_key_sync(db, "test-master-key") == (
        "env-master-key", None, "alchemist"
    )
