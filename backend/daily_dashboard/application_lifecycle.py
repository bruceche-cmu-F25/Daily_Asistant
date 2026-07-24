"""The Application lifecycle vocabulary and its rules, owned in one place.

The pipeline stages, the terminal outcomes, the contact vocabularies and the
monotonic advancement rule all live here. The runtime tuples are derived from
the ``Literal`` types via ``get_args`` so the validation surface, the ranking
used to advance a stage, and the database ``CHECK`` constraints in ``models``
cannot drift apart.

(Two copies remain outside this module and are deliberately not consumed from
here: the frozen Alembic migration strings — history, never rewritten — and the
TypeScript unions in ``frontend/src/types.ts``, which would need a served
endpoint or codegen to share this source across the language seam.)
"""

from __future__ import annotations

from typing import Literal, get_args


ApplicationStage = Literal[
    "saved",
    "applied",
    "oa",
    "recruiter_screen",
    "interview",
    "offer",
    "rejected",
    "withdrawn",
]
ContactType = Literal["none", "alumni", "recruiter", "hiring_manager", "employee", "other"]
ContactStatus = Literal["not_contacted", "planned", "contacted", "replied"]

STAGES: tuple[str, ...] = get_args(ApplicationStage)
CONTACT_TYPES: tuple[str, ...] = get_args(ContactType)
CONTACT_STATUSES: tuple[str, ...] = get_args(ContactStatus)

TERMINAL_STAGES = frozenset({"rejected", "withdrawn"})
PIPELINE_STAGES: tuple[str, ...] = tuple(stage for stage in STAGES if stage not in TERMINAL_STAGES)
STAGE_RANK: dict[str, int] = {stage: rank for rank, stage in enumerate(PIPELINE_STAGES)}


def stage_advances(current: str, proposed: str) -> bool:
    """Whether a proposed stage may replace the current one.

    Advancement is monotonic along the pipeline; a terminal outcome
    (rejected/withdrawn) may always be recorded, even from a later stage.
    """
    if proposed in TERMINAL_STAGES:
        return True
    return STAGE_RANK.get(proposed, -1) >= STAGE_RANK.get(current, -1)


def sql_check(column: str, values: tuple[str, ...]) -> str:
    """Render a SQLite ``column IN ('a', 'b', ...)`` check for a vocabulary."""
    joined = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({joined})"
