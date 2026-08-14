"""Read-only status adapter for the local Pi Web sidecar."""

from __future__ import annotations

import os
from time import monotonic
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter


router = APIRouter(prefix="/api/v1/pi-web", tags=["pi-web"])
PI_WEB_URL = os.environ.get("PI_WEB_URL", "http://127.0.0.1:30141").rstrip("/")
PI_WEB_TIMEOUT_SECONDS = 0.8


def fetch_pi_web_status() -> dict[str, bool | int | str | None]:
    """Probe Pi Web without exposing or proxying its privileged agent API."""

    started_at = monotonic()
    request = Request(
        f"{PI_WEB_URL}/",
        headers={"User-Agent": "Daily-Dashboard/2.0"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=PI_WEB_TIMEOUT_SECONDS) as response:
            online = 200 <= response.status < 500
    except (OSError, TimeoutError, URLError):
        return {
            "online": False,
            "url": PI_WEB_URL,
            "latency_ms": None,
            "detail": "Pi Web is not responding",
        }

    return {
        "online": online,
        "url": PI_WEB_URL,
        "latency_ms": round((monotonic() - started_at) * 1000),
        "detail": "Pi Web is ready" if online else "Pi Web returned an error",
    }


@router.get("/status")
def pi_web_status() -> dict[str, bool | int | str | None]:
    return fetch_pi_web_status()
