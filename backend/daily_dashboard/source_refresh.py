"""Orchestrate independent Source Adapters into one published Daily Snapshot."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .snapshot import SnapshotStore


@dataclass(frozen=True)
class RefreshContext:
    today: str
    generated_at: str
    previous: dict[str, Any]


@dataclass(frozen=True)
class SourceResult:
    name: str
    fields: dict[str, Any]
    ok: bool
    detail: str


class SourceAdapter(Protocol):
    name: str

    def refresh(self, context: RefreshContext) -> SourceResult: ...


@dataclass(frozen=True)
class RefreshReport:
    published: dict[str, Any]
    results: tuple[SourceResult, ...]

    def fresh_fields(self, source: str) -> dict[str, Any]:
        for result in self.results:
            if result.name == source and result.ok:
                return result.fields
        return {}


class SourceRefresh:
    """Own full/partial refresh ordering, failure isolation and publication."""

    def __init__(self, store: SnapshotStore, adapters: list[SourceAdapter]):
        self.store = store
        self.adapters = tuple(adapters)

    def run(
        self,
        *,
        today: str,
        generated_at: str,
        base_fields: dict[str, Any],
    ) -> RefreshReport:
        context = RefreshContext(
            today=today,
            generated_at=generated_at,
            previous=self.store.load(),
        )
        candidate = {
            **base_fields,
            "date": today,
            "generated_at": generated_at,
        }
        results: list[SourceResult] = []
        for adapter in self.adapters:
            try:
                result = adapter.refresh(context)
                if result.name != adapter.name:
                    raise ValueError(
                        f"Source Adapter {adapter.name!r} returned result for {result.name!r}"
                    )
            except Exception as error:
                result = SourceResult(
                    name=adapter.name,
                    fields={},
                    ok=False,
                    detail=f"{error.__class__.__name__}: {error}",
                )
            results.append(result)
            candidate.update(result.fields)

        candidate["source_status"] = [
            {"name": result.name, "ok": result.ok, "detail": result.detail}
            for result in results
        ]
        return RefreshReport(
            published=self.store.publish(candidate),
            results=tuple(results),
        )
