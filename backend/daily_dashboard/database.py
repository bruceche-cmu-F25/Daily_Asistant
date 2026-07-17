"""Database configuration for the v2 local application."""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .legacy import PROJECT_ROOT


DATABASE_PATH = Path(
    os.environ.get("DASHBOARD_V2_DB_PATH", PROJECT_ROOT / "data" / "daily_v2.db")
)


class Base(DeclarativeBase):
    pass


def sqlite_url(path: Path = DATABASE_PATH) -> str:
    return f"sqlite:///{Path(path).resolve()}"


def make_engine(path: Path = DATABASE_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(sqlite_url(path), connect_args={"check_same_thread": False})


SessionLocal = sessionmaker(bind=make_engine(), autoflush=False, expire_on_commit=False)
