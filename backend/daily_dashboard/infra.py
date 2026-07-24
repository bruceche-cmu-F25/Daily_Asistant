"""Shared runtime seams: the wall clock and the request-scoped database session.

Every local record carries ISO timestamps and every router needs a session, so
both live here. Domain modules then no longer import one another just for
plumbing — a Trip Plan router should not depend on the Applications module for a
timestamp, nor on the NeetCode attempts module for a database session.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Generator

from sqlalchemy.orm import Session

from .database import make_engine


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def get_session() -> Generator[Session, None, None]:
    with Session(make_engine()) as session:
        yield session
