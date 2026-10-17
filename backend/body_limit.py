"""
Request-body cap for the public brain routes, enforced in ASGI before FastAPI reads the body.

A FastAPI dependency cannot do this: the framework reads and JSON-parses the whole body
before it resolves dependencies, and a chunked upload carries no Content-Length to check.
Measured on the first version of the brain routes (a ``Content-Length`` check inside the
rate gate): a 60 MB chunked POST peaked at ~640 MB of resident memory and was *processed*,
and a 30 MB declared-length POST was parsed in full and only then answered 413.

This middleware answers 413 for a declared length over the cap without invoking the app,
and otherwise counts bytes as they arrive so a chunked body is cut off at the cap.
Railway's edge documents no request-body size limit, so this is the only guard.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable, FrozenSet, MutableMapping

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]

_BODY = b'{"success":false,"error":"Request body too large"}'


class _BodyTooLarge(Exception):
    """Raised out of the wrapped ``receive`` once the running total passes the cap."""


class BodyLimitMiddleware:
    def __init__(self, app: Callable[..., Awaitable[None]], paths: FrozenSet[str], max_bytes: int):
        self.app = app
        self.paths = paths
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] not in self.paths:
            await self.app(scope, receive, send)
            return

        async def reject() -> None:
            await send(
                {
                    "type": "http.response.start",
                    "status": 413,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(_BODY)).encode()),
                        (b"connection", b"close"),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": _BODY})

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await reject()
            return

        total = 0
        started = False
        rejected = False

        async def capped_receive() -> Message:
            nonlocal total, rejected
            message = await receive()
            if message["type"] == "http.request":
                total += len(message.get("body", b""))
                if total > self.max_bytes:
                    if not started and not rejected:
                        rejected = True
                        await reject()
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if rejected:
                return  # FastAPI turns the error raised from receive() into its own 400; drop it
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, capped_receive, tracking_send)
        except _BodyTooLarge:
            if not started and not rejected:
                await reject()
