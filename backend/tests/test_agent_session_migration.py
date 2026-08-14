import sqlite3

from alembic import command
from alembic.config import Config

from daily_dashboard.database import sqlite_url
from daily_dashboard.legacy import PROJECT_ROOT


def test_existing_agent_history_moves_to_previous_chat(tmp_path):
    database = tmp_path / "daily_v2.db"
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", sqlite_url(database))
    command.upgrade(config, "0009_daily_agent_trace")

    connection = sqlite3.connect(database)
    connection.execute(
        """
        INSERT INTO agent_messages
          (role, content, tool_calls_json, trace_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("user", "Keep this conversation", "[]", "{}", "2026-08-09T09:00:00-07:00"),
    )
    connection.commit()
    connection.close()

    command.upgrade(config, "head")

    connection = sqlite3.connect(database)
    sessions = connection.execute(
        "SELECT id, title, created_at, updated_at FROM agent_sessions"
    ).fetchall()
    messages = connection.execute(
        "SELECT session_id, content FROM agent_messages"
    ).fetchall()
    connection.close()

    assert sessions == [
        (1, "Previous chat", "2026-08-09T09:00:00-07:00", "2026-08-09T09:00:00-07:00")
    ]
    assert messages == [(1, "Keep this conversation")]
