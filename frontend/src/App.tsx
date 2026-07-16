import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";

import { loadNeetCode } from "./api";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HomePage } from "./pages/HomePage";
import { NeetCodePage } from "./pages/NeetCodePage";
import type { NeetCodeSnapshot, Problem } from "./types";

const emptySnapshot: NeetCodeSnapshot = {
  problems: [],
  progress: {},
  topics: [],
  summary: { completed: 0, total: 0, stuck: 0 },
};

export function App() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadNeetCode().then(setSnapshot).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load local data");
    });
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return snapshot.problems.filter((problem) =>
      `${problem.title} ${problem.topic} ${problem.difficulty}`.toLowerCase().includes(normalized),
    ).slice(0, 7);
  }, [query, snapshot.problems]);

  const openProblem = (problem: Problem) => {
    window.open(problem.start_url, "_blank", "noopener,noreferrer");
    setQuery("");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="Daily OS home">
          <span className="brand-mark">&gt;_</span>
          <span>BRUCE / DAILY OS</span>
        </NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/">TODAY</NavLink>
          <NavLink to="/neetcode">NEETCODE</NavLink>
          <NavLink to="/discover">DISCOVER</NavLink>
        </nav>
        <div className="global-search" role="search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) openProblem(matches[0]);
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search problems and resources…"
            aria-label="Global search"
          />
          {query && (
            <div className="search-results" role="listbox">
              {matches.length ? matches.map((problem) => (
                <button key={problem.key} type="button" onClick={() => openProblem(problem)}>
                  <span className="result-mark">NC</span>
                  <span><b>{problem.title}</b><small>NeetCode 150 · {problem.topic}</small></span>
                  <span>↗</span>
                </button>
              )) : <p>No matching local result.</p>}
            </div>
          )}
        </div>
        <button className="sync-button" type="button" disabled title="Enabled in sync slice">
          READ ONLY
        </button>
      </header>
      {error && <div className="error-banner">{error}</div>}
      <Routes>
        <Route path="/" element={<HomePage snapshot={snapshot} onOpenNeetCode={() => navigate("/neetcode")} />} />
        <Route path="/neetcode" element={<NeetCodePage snapshot={snapshot} />} />
        <Route path="/discover" element={<DiscoverPage />} />
      </Routes>
      <footer>LOCAL-FIRST / READ-ONLY MIGRATION BUILD / PORT 8766</footer>
    </div>
  );
}
