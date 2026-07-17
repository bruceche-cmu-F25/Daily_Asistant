import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { loadDashboard, loadNeetCode } from "./api";
import { BrandGlyph, brandIdentity } from "./components/BrandLogo";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HomePage } from "./pages/HomePage";
import { LearnPage } from "./pages/LearnPage";
import { NeetCodePage } from "./pages/NeetCodePage";
import { dashboardResources, type DashboardResource } from "./resources";
import type { DashboardSnapshot, NeetCodeSnapshot, Problem } from "./types";

const emptySnapshot: NeetCodeSnapshot = {
  problems: [],
  progress: {},
  attempts: [],
  topics: [],
  summary: { completed: 0, total: 0, stuck: 0 },
};

const emptyDashboard: DashboardSnapshot = {
  date: "",
  generated_at: "",
  weekly_plan: { title: "Road Map", url: "" },
  metrics: { calendar_events: 0, notion_tasks: 0, fresh_jobs: 0 },
  source_status: [],
  stale_sources: ["Calendar", "Notion", "Brave Search"],
  events: [],
  links: { study: [], jobs: [] },
  weekly: [],
  notion: [],
  jobs: [],
  news: [],
  discover_events: [],
  job_groups: {},
  quick_actions: [],
  quiet_links: [],
  target_copy: "",
  target_copy_cn: "",
};

type SearchMatch =
  | { kind: "problem"; problem: Problem }
  | { kind: "resource"; resource: DashboardResource }
  | { kind: "section"; title: string; subtitle: string; path: string };

const searchableSections = [
  { title: "Today", subtitle: "Todo, calendar and quick launch", path: "/#today-queue" },
  { title: "NeetCode 150", subtitle: "Roadmap, workspace and history", path: "/neetcode" },
  { title: "Job Hunt", subtitle: "Application platforms and curated lists", path: "/#job-resources" },
  { title: "Learning Lab", subtitle: "freeCodeCamp JavaScript, Python engineering and project practice", path: "/learn" },
  { title: "Study Resources", subtitle: "Courses and project-based learning", path: "/#study-resources" },
  { title: "Discover", subtitle: "Tech news and events", path: "/discover" },
];

export function App() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [clock, setClock] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const refreshSnapshot = useCallback(() => {
    loadNeetCode().then(setSnapshot).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load local data");
    });
  }, []);

  useEffect(() => {
    refreshSnapshot();
    loadDashboard().then(setDashboard).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load dashboard snapshot");
    });
  }, [refreshSnapshot]);

  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Los_Angeles" }).format(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [] as SearchMatch[];
    const problems: SearchMatch[] = snapshot.problems
      .filter((problem) => `${problem.title} ${problem.topic} ${problem.difficulty}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((problem) => ({ kind: "problem", problem }));
    const resources: SearchMatch[] = dashboardResources
      .filter((resource) => `${resource.title} ${resource.subtitle} ${resource.category}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((resource) => ({ kind: "resource", resource }));
    const sections: SearchMatch[] = searchableSections
      .filter((section) => `${section.title} ${section.subtitle}`.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map((section) => ({ kind: "section", ...section }));
    return [...resources, ...problems, ...sections].slice(0, 9);
  }, [query, snapshot.problems]);

  const openProblem = (problem: Problem) => {
    window.open(problem.start_url, "_blank", "noopener,noreferrer");
    setQuery("");
  };

  const openMatch = (match: SearchMatch) => {
    if (match.kind === "problem") {
      openProblem(match.problem);
      return;
    }
    if (match.kind === "resource") {
      window.open(match.resource.url, "_blank", "noopener,noreferrer");
      setQuery("");
      return;
    }
    navigate(match.path);
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
          <a href="/#today">TODAY</a>
          <a href="/#plan">PLAN</a>
          <NavLink to="/learn">LEARN</NavLink>
          <NavLink to="/neetcode">NEETCODE</NavLink>
          <a href="/neetcode#history">HISTORY</a>
          <a href="/#jobs">JOBS</a>
          <NavLink to="/discover">SIGNAL</NavLink>
        </nav>
        <div className="global-search" role="search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) openMatch(matches[0]);
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search problems and resources…"
            aria-label="Global search"
          />
          {query && (
            <div className="search-results" role="listbox">
              {matches.length ? matches.map((match) => (
                <button
                  key={match.kind === "problem" ? match.problem.key : match.kind === "resource" ? match.resource.id : match.path}
                  type="button"
                  onClick={() => openMatch(match)}
                >
                  <span className="result-mark">
                    {match.kind === "problem"
                      ? <BrandGlyph brand="neetcode" fallback="NC" />
                      : match.kind === "resource"
                        ? <BrandGlyph {...brandIdentity(match.resource.url)} fallback={match.resource.mark} />
                        : "//"}
                  </span>
                  <span>
                    <b>{match.kind === "problem" ? match.problem.title : match.kind === "resource" ? match.resource.title : match.title}</b>
                    <small>{match.kind === "problem" ? `NeetCode 150 · ${match.problem.topic}` : match.kind === "resource" ? `Resource · ${match.resource.subtitle}` : `Section · ${match.subtitle}`}</small>
                  </span>
                  <span>{match.kind === "section" ? "→" : "↗"}</span>
                </button>
              )) : <p>No matching local result.</p>}
            </div>
          )}
        </div>
        <div className={`sync-button${dashboard.stale_sources.length ? " stale" : ""}`}>
          {dashboard.stale_sources.length ? "DEGRADED MODE" : "ALL SYSTEMS ONLINE"} · {clock}
        </div>
      </header>
      {error && <div className="error-banner">{error}</div>}
      <Routes>
        <Route path="/" element={<HomePage dashboard={dashboard} />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/neetcode" element={<NeetCodePage snapshot={snapshot} onRefresh={refreshSnapshot} />} />
        <Route path="/discover" element={<DiscoverPage dashboard={dashboard} />} />
      </Routes>
      {location.pathname !== "/" && <footer>LOCAL-FIRST / PARALLEL PREVIEW / PORT 8766</footer>}
    </div>
  );
}
