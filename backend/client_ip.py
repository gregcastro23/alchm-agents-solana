"""Which client address the rate gates key on."""
from __future__ import annotations

from fastapi import Request

# A key is held in memory per distinct caller; bound its size so a header cannot bloat the table.
MAX_KEY_LENGTH = 64


def client_ip(request: Request) -> str:
    """``X-Real-IP`` (the header Railway documents its edge as setting), else the first
    ``X-Forwarded-For`` hop, else the socket peer.

    The first ``X-Forwarded-For`` hop is whatever the caller chose to send; ``X-Real-IP`` is
    only trustworthy if the edge overwrites it. That has not been confirmed on the production
    service, so the global limits remain the real backstop (docs/integrations/PENTACLES_BRAIN.md).
    """
    real = request.headers.get("x-real-ip", "").strip()
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    peer = request.client.host if request.client else "unknown"
    return (real or forwarded or peer)[:MAX_KEY_LENGTH]
