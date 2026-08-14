from dataclasses import dataclass

import anyio
from sqlalchemy.orm import Session

from daily_dashboard.agent_sessions import conversation_history, create_session
from daily_dashboard.agent_turns import AgentTurnEvent, ModelResponse, run_agent_turn
from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database


@dataclass(frozen=True)
class FakeSettings:
    model: str = "test-model"


def test_agent_turn_interface_owns_persistence_trace_and_events(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)
    engine = make_engine(database)

    async def fake_model(_settings, messages):
        assert messages[-1] == {"role": "user", "content": "Summarize today"}
        return ModelResponse(
            message={"role": "assistant", "content": "Today is focused."},
            usage={
                "prompt_tokens": 8,
                "completion_tokens": 3,
                "total_tokens": 11,
                "cached_tokens": 2,
            },
        )

    async def run() -> tuple[list[AgentTurnEvent], int]:
        with Session(engine) as session:
            agent_session = create_session(session, now="2026-08-10T09:00:00-07:00")
            session.commit()
            events = [event async for event in run_agent_turn(
                session=session,
                session_id=agent_session.id,
                message="Summarize today",
                settings=FakeSettings(),
                call_model=fake_model,
            )]
            return events, agent_session.id

    events, session_id = anyio.run(run)
    assert [event.type for event in events] == ["started", "text", "done"]
    assert events[-1].payload["message"]["content"] == "Today is focused."

    with Session(engine) as session:
        history = conversation_history(session, session_id)
    assert [item["role"] for item in history] == ["user", "assistant"]
    assert history[-1]["trace"]["status"] == "completed"
    assert history[-1]["trace"]["total_tokens"] == 11
