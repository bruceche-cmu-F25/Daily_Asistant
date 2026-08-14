import { useMemo, useState } from "react";

import type { DashboardSnapshot, DiscoverEvent } from "../types";

type Props = { dashboard: DashboardSnapshot };
type Filter = "all" | "local" | "company";

const officialSources = [
  { mark: "LU", name: "Bay Area AI on Luma", note: "San Francisco AI and builder events", url: "https://luma.com/discover/sf/ai", kind: "local" },
  { mark: "SV", name: "Silicon Valley Startups", note: "Founder, startup and investor events", url: "https://luma.com/sve", kind: "local" },
  { mark: "CM", name: "CMU Silicon Valley", note: "Official Silicon Valley campus calendar", url: "https://events.cmu.edu/sv/", kind: "campus" },
  { mark: "CS", name: "CMU-SV Career Events", note: "Workshops, employer events and networking", url: "https://www.sv.cmu.edu/current-students/career-services/workshops-and-events.html", kind: "campus" },
  { mark: "G", name: "Google Developers", note: "GDG, DevFest and Build with AI", url: "https://developers.google.com/community", kind: "company" },
  { mark: "MS", name: "Microsoft Reactor", note: "Live developer events and training", url: "https://developer.microsoft.com/en-us/reactor/", kind: "company" },
  { mark: "A", name: "Anthropic Events", note: "Claude webinars and builder events", url: "https://www.anthropic.com/events", kind: "company" },
  { mark: "", name: "Apple Developer", note: "Sessions, labs and workshops", url: "https://developer.apple.com/events/", kind: "company" },
  { mark: "NV", name: "NVIDIA Workshops", note: "AI and accelerated computing training", url: "https://www.nvidia.com/en-us/training/instructor-led-workshops/", kind: "company" },
];

const localSources = new Set(["Luma", "CMU-SV", "CMU", "Community"]);

const bayAreaPattern = /bay area|silicon valley|san francisco|\bsf\b|south bay|peninsula|mountain view|sunnyvale|santa clara|san jos[eé]|palo alto|redwood city|menlo park|cupertino|moffett field|san mateo|foster city|fremont|oakland|berkeley/i;

function isBayAreaEvent(event: DiscoverEvent) {
  const text = `${event.title} ${event.snippet}`;
  return !/pittsburgh|\bpgh\b/i.test(text) && bayAreaPattern.test(text);
}

function eventMatches(event: DiscoverEvent, filter: Filter, query: string) {
  if (!isBayAreaEvent(event)) return false;
  if (filter === "local" && !localSources.has(event.source)) return false;
  if (filter === "company" && localSources.has(event.source)) return false;
  const normalized = query.trim().toLowerCase();
  return !normalized || `${event.title} ${event.snippet} ${event.source}`.toLowerCase().includes(normalized);
}

export function DiscoverPage({ dashboard }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const discoveredEvents = (dashboard.discover_events ?? []).filter(isBayAreaEvent);
  const candidates = useMemo(
    () => discoveredEvents.filter((event) => eventMatches(event, filter, query)),
    [discoveredEvents, filter, query],
  );

  return (
    <main className="discover-page">
      <section className="panel discover-hero">
        <div>
          <p className="eyebrow">READ ONLY · NO AUTO-REGISTRATION</p>
          <h1>Bay Area Events</h1>
          <p>CMU Silicon Valley, South Bay, the Peninsula, and San Francisco.</p>
        </div>
        <div className="discover-stats" aria-label="Discover summary">
          <div><b>{dashboard.events.length.toString().padStart(2, "0")}</b><span>today</span></div>
          <div><b>{discoveredEvents.length.toString().padStart(2, "0")}</b><span>event candidates</span></div>
          <div><b>{dashboard.news.length.toString().padStart(2, "0")}</b><span>news signals</span></div>
        </div>
      </section>

      <section className="panel discover-section today-events" aria-labelledby="today-events-title">
        <div className="discover-heading">
          <div><h2 id="today-events-title">Today’s Calendar</h2></div>
          <span>{dashboard.date || "Waiting for sync"}</span>
        </div>
        <div className="today-event-grid">
          {dashboard.events.length ? dashboard.events.map((event) => (
            <article key={event.key}>
              <time>{event.start_time || "ALL DAY"}</time>
              <div><b>{event.title}</b><span>{event.location || event.calendar}</span></div>
              {event.url && <a href={event.url} target="_blank" rel="noopener noreferrer">OPEN ↗</a>}
            </article>
          )) : <p className="discover-empty">今天的日历里没有活动。</p>}
        </div>
      </section>

      <section className="panel discover-section" aria-labelledby="event-radar-title">
        <div className="discover-heading radar-heading">
          <div><h2 id="event-radar-title">Upcoming Events</h2></div>
          <div className="event-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search discovered events" placeholder="Search AI, startup, webinar…" /></div>
        </div>
        <div className="event-filters" role="group" aria-label="Event source filter">
          {(["all", "local", "company"] as Filter[]).map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "ALL BAY AREA" : item === "local" ? "SILICON VALLEY + CMU" : "BIG TECH + BAY AREA"}</button>
          ))}
        </div>
        <p className="candidate-note">自动搜索只负责发现候选；时间、地点和报名状态以打开后的官方页面为准。</p>
        <div className="event-candidate-grid">
          {candidates.length ? candidates.map((event) => (
            <a href={event.link} key={event.link} target="_blank" rel="noopener noreferrer">
              <span className={`event-source source-${event.source.toLowerCase()}`}>{event.source}</span>
              <b>{event.title}</b>
              <p>{event.snippet || "Open the source to confirm details."}</p>
              <small>VERIFY DATE + REGISTER ↗</small>
            </a>
          )) : <div className="discover-empty">当前筛选没有候选。可以直接使用下面的官方入口。</div>}
        </div>
      </section>

      <section className="panel discover-section" aria-labelledby="official-sources-title">
        <div className="discover-heading"><div><h2 id="official-sources-title">Event Sources</h2></div><span>Luma and official event pages</span></div>
        <div className="official-source-grid">
          {officialSources.map((source) => (
            <a className={`official-source ${source.kind}`} href={source.url} key={source.url} target="_blank" rel="noopener noreferrer">
              <span>{source.mark}</span><div><b>{source.name}</b><small>{source.note}</small></div><i>↗</i>
            </a>
          ))}
        </div>
      </section>

      <section className="panel discover-section" aria-labelledby="tech-news-title">
        <div className="discover-heading"><div><h2 id="tech-news-title">Tech News</h2></div><span>Headlines only</span></div>
        <ol className="discover-news">
          {dashboard.news.length ? dashboard.news.map((item, index) => (
            <li key={item.link}><span>{String(index + 1).padStart(2, "0")}</span><div><a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a><p>{item.snippet}</p></div></li>
          )) : <li className="discover-empty">等待早上 9 点刷新新闻快照。</li>}
        </ol>
      </section>
    </main>
  );
}
