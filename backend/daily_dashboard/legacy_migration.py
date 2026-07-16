"""One-time, repeat-safe import from the legacy problem_progress database."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import DATABASE_PATH, make_engine, sqlite_url
from .legacy import LEGACY_DB_PATH, PROJECT_ROOT, load_legacy_progress
from .models import MigrationMarker, ProblemAttempt


MARKER_NAME = "legacy_problem_progress_v1"


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def upgrade_database(target: Path) -> None:
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", sqlite_url(target))
    command.upgrade(config, "head")


def backup_database(source: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().astimezone().strftime("%Y%m%d-%H%M%S-%f")
    destination = backup_dir / f"dashboard-before-v2-{timestamp}.db"
    source_connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    destination_connection = sqlite3.connect(destination)
    try:
        source_connection.backup(destination_connection)
    finally:
        destination_connection.close()
        source_connection.close()
    return destination


def import_legacy_progress(source: Path, target: Path) -> dict[str, object]:
    engine = make_engine(target)
    with Session(engine) as session:
        marker = session.get(MigrationMarker, MARKER_NAME)
        if marker:
            detail = json.loads(marker.detail_json)
            return {"already_imported": True, **detail}

        progress = load_legacy_progress(source)
        imported = 0
        for problem_key, record in progress.items():
            status = "solved" if record.get("completed") else "stuck"
            has_content = any((
                record.get("completed"),
                int(record.get("stuck_count", 0)) > 0,
                record.get("solution"),
                record.get("reflection"),
            ))
            if not has_content:
                continue
            created_at = record.get("completed_at") or record.get("updated_at") or now_iso()
            session.add(ProblemAttempt(
                problem_key=problem_key,
                status=status,
                language="python",
                solution=str(record.get("solution") or ""),
                reflection=str(record.get("reflection") or ""),
                source="legacy-v1",
                legacy_stuck_count=int(record.get("stuck_count", 0)),
                created_at=created_at,
                updated_at=str(record.get("updated_at") or created_at),
            ))
            imported += 1

        detail = {"records_seen": len(progress), "attempts_imported": imported}
        session.add(MigrationMarker(
            name=MARKER_NAME,
            applied_at=now_iso(),
            detail_json=json.dumps(detail, ensure_ascii=False, sort_keys=True),
        ))
        session.commit()
        return {"already_imported": False, **detail}


def migrate_legacy(
    source: Path = LEGACY_DB_PATH,
    target: Path = DATABASE_PATH,
    backup_dir: Path | None = None,
) -> dict[str, object]:
    source = Path(source)
    target = Path(target)
    backup_dir = Path(backup_dir or PROJECT_ROOT / "data" / "backups")
    upgrade_database(target)

    engine = make_engine(target)
    with Session(engine) as session:
        existing = session.scalar(
            select(MigrationMarker).where(MigrationMarker.name == MARKER_NAME)
        )
    if existing:
        result = import_legacy_progress(source, target)
        return {"backup": None, **result}

    backup = backup_database(source, backup_dir) if source.is_file() else None
    result = import_legacy_progress(source, target)
    return {"backup": str(backup) if backup else None, **result}


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy problem history to v2")
    parser.add_argument("--source", type=Path, default=LEGACY_DB_PATH)
    parser.add_argument("--target", type=Path, default=DATABASE_PATH)
    parser.add_argument("--backup-dir", type=Path, default=PROJECT_ROOT / "data" / "backups")
    args = parser.parse_args()
    result = migrate_legacy(args.source, args.target, args.backup_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
