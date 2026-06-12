import asyncio
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select, delete
from database import SessionLocal
from models import DesktopApiKey, MCPInvocation, User, UserSubscription

# Constants
PA_USER_API_KEY = os.getenv("PA_USER_API_KEY")
PA_CRON_SECRET = os.getenv("PA_CRON_SECRET")

# Strong references to in-flight fire-and-forget telemetry writes. asyncio only
# keeps WEAK references to tasks created with create_task(), so a write task
# with no other referent can be garbage-collected before it commits — silently
# dropping the mcp_invocations row and leaving the admin summary stuck on
# UNKNOWN. Holding the task here until its done-callback fires closes that gap.
_INFLIGHT_WRITES: "set[asyncio.Task]" = set()

def _log(msg: str) -> None:
    import sys
    print(msg, file=sys.stderr, flush=True)

def resolve_api_key_sync(db, api_key: str) -> Tuple[Optional[str], Optional[str], str]:
    """Resolves an API key string into (api_key_id, user_id, auth_tier).
    
    Auth tiers:
      - "alchemist" (master env key, admin, or alchemist subscription)
      - "standard" (active database key, limited to free/cheap_fast)
      - "anonymous" (invalid or missing key)
    """
    if not api_key:
        return None, None, "anonymous"

    # 1. Master env key check
    if PA_USER_API_KEY and api_key == PA_USER_API_KEY:
        return "env-master-key", None, "alchemist"

    # 2. Database key lookup
    try:
        stmt = select(DesktopApiKey).where(
            DesktopApiKey.token == api_key,
            DesktopApiKey.isActive.is_(True)
        )
        result = db.execute(stmt)
        key_row = result.scalar_one_or_none()
        
        if key_row:
            # Update lastUsedAt in the background/sync path
            key_row.lastUsedAt = datetime.utcnow()
            db.commit()

            user_id = key_row.userId
            # Check user role or subscription tier
            user_stmt = select(User).where(User.id == user_id)
            user_result = db.execute(user_stmt).scalar_one_or_none()
            
            sub_stmt = select(UserSubscription).where(UserSubscription.userId == user_id)
            sub_result = db.execute(sub_stmt).scalar_one_or_none()

            role = user_result.role if user_result else "user"
            sub_tier = sub_result.tier if sub_result else "free"

            is_premium = (
                role in ("admin", "alchemist") or
                sub_tier.lower() in ("alchemist", "premium", "pro", "unlimited", "paid")
            )
            
            auth_tier = "alchemist" if is_premium else "standard"
            return key_row.id, user_id, auth_tier
    except Exception as exc:
        _log(f"Error resolving api key: {exc}")

    return None, None, "anonymous"


def validate_and_gate_invocation(
    tool_name: str, 
    arguments: Dict[str, Any]
) -> Tuple[Dict[str, Any], Optional[str], Optional[str], str, Optional[str]]:
    """Validates the invocation arguments and applies model-tier / debate gating.
    
    Returns:
      - gated_arguments: Dict[str, Any] (with potentially downgraded modelTier/agents)
      - api_key_id: Optional[str]
      - user_id: Optional[str]
      - auth_tier: str
      - resolved_model_tier: str
    """
    # Extract _meta properties
    meta = arguments.get("_meta") or {}
    api_key = meta.get("apiKey") or meta.get("api_key")

    # Resolve authorization
    db = SessionLocal()
    try:
        api_key_id, user_id, auth_tier = resolve_api_key_sync(db, api_key)
    finally:
        db.close()

    # Determine original requested modelTier
    orig_model_tier = arguments.get("modelTier") or "free"
    resolved_model_tier = orig_model_tier

    gated_args = dict(arguments)

    # Apply gating based on auth_tier
    if auth_tier == "anonymous":
        # Force free model tier
        resolved_model_tier = "free"
        gated_args["modelTier"] = "free"
        
        # Gate synthesize_culinary_debate to single persona
        if tool_name == "synthesize_culinary_debate":
            agents = arguments.get("agents") or ["Socrates", "Rumi", "Galileo"]
            gated_args["agents"] = agents[:1]
            
    elif auth_tier == "standard":
        # Free-tier/Standard keys can only invoke "free" or "cheap_fast"
        if orig_model_tier in ("primary", "reflective"):
            resolved_model_tier = "cheap_fast"
            gated_args["modelTier"] = "cheap_fast"
            
        # Gate debate to single persona for standard keys
        if tool_name == "synthesize_culinary_debate":
            agents = arguments.get("agents") or ["Socrates", "Rumi", "Galileo"]
            gated_args["agents"] = agents[:1]
            
    else:  # alchemist
        # Full access to everything
        pass

    return gated_args, api_key_id, user_id, auth_tier, resolved_model_tier


async def _record_in_db(
    tool_name: str,
    called_at: datetime,
    completed_at: datetime,
    latency_ms: int,
    success: bool,
    caller: Optional[str],
    arguments: Dict[str, Any],
    result_summary: Dict[str, Any],
    error_message: Optional[str],
    agent_id: Optional[str],
    model_tier: Optional[str],
    api_key_id: Optional[str],
    user_id: Optional[str]
) -> None:
    loop = asyncio.get_running_loop()
    def _db_write():
        db = SessionLocal()
        try:
            # Prepare arguments and result summary to be serializable, excluding _meta secrets
            clean_arguments = dict(arguments)
            if "_meta" in clean_arguments:
                meta = dict(clean_arguments["_meta"])
                # Strip raw apiKey for safety
                if "apiKey" in meta:
                    meta["apiKey"] = "[REDACTED]"
                if "api_key" in meta:
                    meta["api_key"] = "[REDACTED]"
                clean_arguments["_meta"] = meta

            invocation = MCPInvocation(
                toolName=tool_name,
                calledAt=called_at,
                completedAt=completed_at,
                latencyMs=latency_ms,
                success=success,
                caller=caller,
                arguments=clean_arguments,
                resultSummary=result_summary,
                errorMessage=error_message,
                agentId=agent_id,
                modelTier=model_tier,
                apiKeyId=api_key_id,
                userId=user_id
            )
            db.add(invocation)
            db.commit()
        except Exception as exc:
            _log(f"[_record_in_db] DB record insertion failed: {exc}")
        finally:
            db.close()

    try:
        await loop.run_in_executor(None, _db_write)
    except Exception as exc:
        _log(f"[_record_in_db] run_in_executor failed: {exc}")


async def record_invocation(
    tool_name: str,
    called_at: datetime,
    completed_at: datetime,
    latency_ms: int,
    success: bool,
    caller: Optional[str],
    arguments: Dict[str, Any],
    result_summary: Dict[str, Any],
    error_message: Optional[str],
    agent_id: Optional[str],
    model_tier: Optional[str],
    api_key_id: Optional[str],
    user_id: Optional[str]
) -> None:
    """Fire-and-forget logging function that writes MCP tool invocations to Postgres."""
    # Spawn a background task so DB write does not block the tool execution.
    # Keep a strong reference until completion so the task can't be GC'd mid-write.
    task = asyncio.create_task(
        _record_in_db(
            tool_name=tool_name,
            called_at=called_at,
            completed_at=completed_at,
            latency_ms=latency_ms,
            success=success,
            caller=caller,
            arguments=arguments,
            result_summary=result_summary,
            error_message=error_message,
            agent_id=agent_id,
            model_tier=model_tier,
            api_key_id=api_key_id,
            user_id=user_id
        )
    )
    _INFLIGHT_WRITES.add(task)
    task.add_done_callback(_INFLIGHT_WRITES.discard)


async def prune_mcp_invocations(retain_days: int = 7) -> int:
    """Deletes mcp_invocations rows older than retain_days. Returns count of deleted rows."""
    loop = asyncio.get_running_loop()
    def _db_prune():
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(days=retain_days)
            stmt = delete(MCPInvocation).where(MCPInvocation.calledAt < cutoff)
            res = db.execute(stmt)
            deleted_count = res.rowcount
            db.commit()
            return deleted_count
        except Exception as exc:
            _log(f"[prune_mcp_invocations] failed: {exc}")
            return 0
        finally:
            db.close()

    return await loop.run_in_executor(None, _db_prune)
