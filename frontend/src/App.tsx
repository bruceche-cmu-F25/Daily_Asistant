import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { loadDashboard, loadNeetCode } from "./api";
import { BrandGlyph, brandIdentity } from "./components/BrandLogo";
import { AgentPage } from "./pages/AgentPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HomePage } from "./pages/HomePage";
import { LearnPage } from "./pages/LearnPage";
import { LifePage } from "./pages/LifePage";
import { NeetCodePage } from "./pages/NeetCodePage";
import { PythonCheatsheetPage } from "./pages/PythonCheatsheetPage";
import { moduleRegistry, type ModuleId } from "./modules/moduleRegistry";
import { pythonCheatsheet, pythonCheatMatches, type PythonCheatItem } from "./pythonCheatsheet";
import { dashboardResources, type DashboardResource } from "./resources";
import type { DashboardSnapshot, NeetCodeSnapshot, Problem } from "./types";

const MODULE_SIDEBAR_STORAGE_KEY = "daily-dashboard:module-sidebar:open";

function readModuleSidebarOpen() {
  try {
    return window.localStorage.getItem(MODULE_SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

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
  | { kind: "python"; item: PythonCheatItem }
  | { kind: "section"; title: string; subtitle: string; path: string };

const searchableSections = [
  { title: "Daily Action", subtitle: "Calendar, applications, learning, and quick launch", path: "/#today-queue" },
  { title: "Application Links", subtitle: "Platforms and curated lists", path: "/#job-resources" },
  { title: "Study Resources", subtitle: "Courses and project-based learning", path: "/#study-resources" },
  ...moduleRegistry.map((module) => ({
    title: module.title,
    subtitle: module.description,
    path: module.path,
  })),
];

export function App() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [clock, setClock] = useState("");
  const [moduleSidebarOpen, setModuleSidebarOpen] = useState(readModuleSidebarOpen);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(MODULE_SIDEBAR_STORAGE_KEY, String(moduleSidebarOpen));
    } catch {
      // The navigation still works when storage is unavailable.
    }
  }, [moduleSidebarOpen]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [] as SearchMatch[];
    const problems: SearchMatch[] = snapshot.problems
      .filter((problem) => `${problem.title} ${problem.topic} ${problem.difficulty}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((problem) => ({ kind: "problem", problem }));
    const resources: SearchMatch[] = dashboardResources
      .filter((resource) => `${resource.title} ${resource.subtitle} ${resource.category} ${resource.searchTerms ?? ""}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((resource) => ({ kind: "resource", resource }));
    const python: SearchMatch[] = pythonCheatsheet
      .filter((item) => pythonCheatMatches(item, normalized))
      .slice(0, 6)
      .map((item) => ({ kind: "python", item }));
    const sections: SearchMatch[] = searchableSections
      .filter((section) => `${section.title} ${section.subtitle}`.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map((section) => ({ kind: "section", ...section }));
    return [...python, ...resources, ...problems, ...sections].slice(0, 9);
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
    if (match.kind === "python") {
      navigate(`/python#${match.item.id}`);
      setQuery("");
      return;
    }
    navigate(match.path);
    setQuery("");
  };

  const moduleElements: Record<ModuleId, ReactNode> = {
    life: <LifePage />,
    learn: <LearnPage />,
    python: <PythonCheatsheetPage />,
    agent: <AgentPage />,
    neetcode: <NeetCodePage snapshot={snapshot} onRefresh={refreshSnapshot} />,
    applications: <ApplicationsPage />,
    discover: <DiscoverPage dashboard={dashboard} />,
  };

  return (
    <div className={`app-shell${location.pathname === "/learn" ? " learn-shell" : ""}`}>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="Daily OS home">
          <span className="brand-mark">&gt;_</span>
          <span>BRUCE / DAILY OS</span>
        </NavLink>
        <button
          className="module-nav-toggle"
          type="button"
          aria-label={moduleSidebarOpen ? "Close module sidebar" : "Open module sidebar"}
          aria-controls="module-sidebar"
          aria-expanded={moduleSidebarOpen}
          onClick={() => setModuleSidebarOpen((current) => !current)}
        >
          <span aria-hidden="true">{moduleSidebarOpen ? "«" : "☰"}</span>
          <b>{moduleSidebarOpen ? "HIDE MODULES" : "SHOW MODULES"}</b>
        </button>
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
            placeholder="Search problems, Python and resources…"
            aria-label="Global search"
          />
          {query && (
            <div className="search-results" role="listbox">
              {matches.length ? matches.map((match) => (
                <button
                  key={match.kind === "problem" ? match.problem.key : match.kind === "resource" ? match.resource.id : match.kind === "python" ? match.item.id : match.path}
                  type="button"
                  onClick={() => openMatch(match)}
                >
                  <span className="result-mark">
                    {match.kind === "problem"
                      ? <BrandGlyph brand="neetcode" fallback="NC" />
                      : match.kind === "resource"
                        ? <BrandGlyph {...brandIdentity(match.resource.url)} fallback={match.resource.mark} />
                        : match.kind === "python"
                          ? "PY"
                        : "//"}
                  </span>
                  <span>
                    <b>{match.kind === "problem" ? match.problem.title : match.kind === "resource" ? match.resource.title : match.kind === "python" ? match.item.title : match.title}</b>
                    <small>{match.kind === "problem" ? `NeetCode 150 · ${match.problem.topic}` : match.kind === "resource" ? `Resource · ${match.resource.subtitle}` : match.kind === "python" ? `Python · ${match.item.action}` : `Section · ${match.subtitle}`}</small>
                  </span>
                  <span>{match.kind === "resource" || match.kind === "problem" ? "↗" : "→"}</span>
                </button>
              )) : <p>No matching local result.</p>}
            </div>
          )}
        </div>
        <div className={`sync-button${dashboard.stale_sources.length ? " stale" : ""}`}>
          {dashboard.stale_sources.length ? "DEGRADED MODE" : "ALL SYSTEMS ONLINE"} · {clock}
        </div>
      </header>
      <div className={`app-body${moduleSidebarOpen ? "" : " sidebar-closed"}`}>
        <aside className="module-sidebar" id="module-sidebar" aria-hidden={!moduleSidebarOpen}>
          <div className="module-sidebar-head">
            <span>YOUR LOCAL WORKSPACE</span>
            <b>MODULES</b>
          </div>
          <nav aria-label="Module navigation">
            <NavLink to="/" aria-label="HOME">
              <span className="module-nav-mark">⌂</span>
              <span><b>Home</b><small>Daily control center</small></span>
            </NavLink>
            {moduleRegistry.map((module, index) => (
              <NavLink to={module.path} aria-label={module.navLabel} data-module-id={module.id} key={module.id}>
                <span className="module-nav-mark">{String(index + 1).padStart(2, "0")}</span>
                <span><b>{module.title}</b><small>{module.description}</small></span>
              </NavLink>
            ))}
          </nav>
          <button className="add-module-button" type="button" disabled>
            <span>+</span>
            <b>Add Module</b>
            <small>COMING NEXT</small>
          </button>
        </aside>
        <div className="app-content">
          {error && <div className="error-banner">{error}</div>}
          <Routes>
            <Route path="/" element={<HomePage dashboard={dashboard} />} />
            {moduleRegistry.map((module) => <Route path={module.path} element={moduleElements[module.id]} key={module.id} />)}
          </Routes>
          {location.pathname !== "/" && location.pathname !== "/learn" && <footer>LOCAL-FIRST / CANONICAL RUNTIME / PORT 8766</footer>}
        </div>
      </div>
    </div>
  );
}
