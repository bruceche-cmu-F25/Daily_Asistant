"""Guards for the single-source Application lifecycle vocabulary."""

from __future__ import annotations

from typing import get_args

from daily_dashboard.application_lifecycle import (
    ApplicationStage,
    PIPELINE_STAGES,
    STAGE_RANK,
    STAGES,
    TERMINAL_STAGES,
    sql_check,
    stage_advances,
)


def test_runtime_stages_track_the_literal_type():
    assert STAGES == get_args(ApplicationStage)


def test_every_pipeline_stage_is_ranked_and_terminals_are_excluded():
    assert set(STAGE_RANK) == set(PIPELINE_STAGES)
    assert TERMINAL_STAGES.isdisjoint(STAGE_RANK)
    assert list(STAGE_RANK.values()) == list(range(len(PIPELINE_STAGES)))


def test_advancement_is_monotonic_with_terminal_override():
    assert stage_advances("applied", "oa") is True
    assert stage_advances("interview", "applied") is False
    for terminal in TERMINAL_STAGES:
        assert stage_advances("offer", terminal) is True


def test_sql_check_matches_the_models_constraint_format():
    assert sql_check("stage", ("saved", "applied")) == "stage IN ('saved', 'applied')"
