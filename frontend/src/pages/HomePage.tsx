import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { loadTodos, saveTodo } from "../api";
import { BrandGlyph, brandIdentity } from "../components/BrandLogo";
import { priorityResources } from "../resources";
import type { DashboardLink, DashboardSnapshot, DigestItem, QuickAction, QuietLink } from "../types";

type Props = { dashboard: DashboardSnapshot };

const quickActionSubtitles: Record<string, string> = {
  Gmail: "Inbox",
  LeetCode: "Problem practice",
  NeetCode: "Roadmap & patterns",
  freeCodeCamp: "JavaScript practice",
  JobRight: "Daily recommendations",
  "This Week": "Weekly plan",
  "DSA Video": "Algorithms course",
  "Harvard Web": "CS50W Web Development",
  "Pi Web": "Local coding agent",
};

const identity = brandIdentity;

function MonthCalendar({ date, eventCount }: { date: string; eventCount: number }) {
  const fallback = new Date();
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = parts ? Number(parts[1]) : fallback.getFullYear();
  const monthIndex = parts ? Number(parts[2]) - 1 : fallback.getMonth();
  const today = parts ? Number(parts[3]) : fallback.getDate();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, monthIndex, 1));
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  return (
    <div className="legacy-month-calendar" role="grid" aria-label={`${monthName} ${year} calendar`}>
      <header className="legacy-calendar-head">
        <div><span>MONTH / ACTIVE</span><b>{monthName}</b></div>
        <div className="legacy-calendar-today"><span>{year}</span><b>{today.toString().padStart(2, "0")}</b></div>
      </header>
      <div className="legacy-calendar-weekdays" role="row">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((weekday) => <span role="columnheader" key={weekday}>{weekday}</span>)}
      </div>
      <div className="legacy-calendar-grid">
        {Array.from({ length: mondayOffset }, (_, index) => <span className="legacy-calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
        {days.map((day) => {
          const state = day < today ? "past" : day === today ? "today" : "future";
          return (
            <div className={`legacy-calendar-day ${state}`} role="gridcell" data-day={day} aria-label={`${monthName} ${day}, ${state === "today" ? "today" : state}`} key={day}>
              <span>{day.toString().padStart(2, "0")}</span>
              {state === "today" && <><b>TODAY</b>{eventCount > 0 && <i>{eventCount} EVENTS</i>}</>}
            </div>
          );
        })}
      </div>
      <footer className="legacy-calendar-legend"><span><i className="past" />PAST / CLOSED</span><span><i className="today" />TODAY</span><span><i className="future" />UPCOMING</span></footer>
    </div>
  );
}

function LinkIcon({ url }: { url: string }) {
  const item = identity(url);
  return <span className={`legacy-link-icon brand-${item.brand}`} data-brand-logo={item.brand} aria-hidden="true"><BrandGlyph brand={item.brand} fallback={item.mark} /></span>;
}

function Pill({ item, className = "legacy-pill" }: { item: DashboardLink; className?: string }) {
  return <a className={`${className} brand-${identity(item.url).brand}`} href={item.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={item.url} /><span>{item.title}</span></a>;
}

export function HomePage({ dashboard }: Props) {
  const [todoState, setTodoState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTodos().then((items) => setTodoState(Object.fromEntries(items.map((item) => [item.item_key, item.completed])))).catch(() => undefined);
  }, []);

  const quickActions = useMemo<QuickAction[]>(() => {
    const configured = priorityResources.map((resource) => ({
      title: resource.title,
      subtitle: resource.subtitle,
      url: resource.url,
      kind: resource.accent === "red" ? "hot" : resource.accent,
    }));
    const snapshotActions = dashboard.quick_actions.length ? dashboard.quick_actions : configured;
    const missingConfigured = configured.filter((resource) => !snapshotActions.some((item) => item.url === resource.url));
    return [...snapshotActions, ...missingConfigured].map((item) => ({
      ...item,
      subtitle: quickActionSubtitles[item.title] ?? item.subtitle,
    }));
  }, [dashboard.quick_actions]);

  const toggle = (key: string, source: string, title: string, initial: boolean) => {
    const completed = !(todoState[key] ?? initial);
    setTodoState((current) => ({ ...current, [key]: completed }));
    saveTodo(key, { source, title, completed }).catch(() => {
      setTodoState((current) => ({ ...current, [key]: !completed }));
    });
  };

  const digest = (items: DigestItem[], source: string) => items.length ? items.map((item, index) => item.is_todo && item.key ? (
    <li className="legacy-check-item" key={item.key}>
      <label className="legacy-check-row">
        <input type="checkbox" checked={todoState[item.key] ?? Boolean(item.checked)} onChange={() => toggle(item.key!, source, item.text, Boolean(item.checked))} />
        <span>{item.text}</span>
      </label>
    </li>
  ) : <li key={`${source}-${index}`}>{item.text}</li>) : <li>No current content found.</li>;

  const quietLinks: QuietLink[] = dashboard.quiet_links;

  return (
    <main className="legacy-home">
      <section className="legacy-hero">
        <div className="legacy-hero-copy">
          <p className="legacy-eyebrow">TODAY · {dashboard.date || "WAITING FOR SYNC"}</p>
          <h1>Daily<br /><span>Action</span></h1>
          <p className="legacy-hero-lede">Calendar, applications, learning—in that order.</p>
          <div className="legacy-hero-actions" aria-label="Primary actions">
            <Link className="legacy-primary-action solve" to="/neetcode"><span>01</span><b>Solve</b><small>NEETCODE 150 →</small></Link>
            <Link className="legacy-primary-action learn" to="/learn"><span>02</span><b>Learn</b><small>JAVASCRIPT + PYTHON →</small></Link>
            <Link className="legacy-primary-action crm" to="/applications"><span>03</span><b>Apply</b><small>AUTO-MATCHED JOBS →</small></Link>
            <Link className="legacy-primary-action discover" to="/discover"><span>04</span><b>Events</b><small>NEWS + EVENTS →</small></Link>
          </div>
          <p className="legacy-hero-meta">Generated {dashboard.generated_at ? dashboard.generated_at.replace("T", " ").slice(0, 16) : "waiting for first sync"} · <a href="https://www.notion.so/35ea5189545c80cfa8c3c910e0265817?source=copy_link" target="_blank" rel="noopener noreferrer">Notion / 变得更强</a>{dashboard.weekly_plan.url && <> · <a href={dashboard.weekly_plan.url} target="_blank" rel="noopener noreferrer">{dashboard.weekly_plan.title}</a></>}</p>
        </div>
        <div className="legacy-hero-readout">
          <MonthCalendar date={dashboard.date} eventCount={dashboard.events.length} />
          <div className="legacy-status-row">{dashboard.source_status.map((source) => <span className={`legacy-status ${source.ok ? "ok" : "warn"}`} key={source.name}><i>{source.ok ? "●" : "△"}</i><b>{source.name}</b><small>{source.detail}</small></span>)}</div>
        </div>
      </section>

      <div className="legacy-page-grid">
        <div className="legacy-main-column">
          <section className="legacy-content-section" id="today" data-index="01 / TODAY">
            <h2>Today’s Schedule</h2>
            {dashboard.events.length ? dashboard.events.map((event) => <article className={`legacy-event${event.all_day ? " allday" : ""}`} key={event.key}>
              <label className="legacy-check-row"><input type="checkbox" checked={todoState[event.key] ?? false} onChange={() => toggle(event.key, "calendar", event.title, false)} /><span><b>{event.start_time || "All day"}</b> · {event.title}</span></label>
              <div className="legacy-meta">{event.calendar}</div>
              {event.url ? <a className="legacy-btn" href={event.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={event.url} />Open / 开始做</a> : <span className="legacy-no-link">No action link / 无跳转链接</span>}
            </article>) : <p className="legacy-sub">No events today.</p>}
          </section>

          <section className="legacy-content-section" id="plan" data-index="02 / PLAN">
            <h2>This Week</h2>
            {dashboard.weekly_plan.url && <p><a className="legacy-btn" href={dashboard.weekly_plan.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={dashboard.weekly_plan.url} />Open current week: {dashboard.weekly_plan.title}</a></p>}
            <div className="legacy-digest-grid"><div><h3>Weekly Checklist</h3><ul>{digest(dashboard.weekly, "notion")}</ul></div><div><h3>Notion Notes</h3><ul>{digest(dashboard.notion, "notion")}</ul></div></div>
            <h3>Learning Links</h3><div className="legacy-pillbox">{dashboard.links.study.map((item) => <Pill item={item} key={item.url} />)}</div>
          </section>

          <section className="legacy-content-section" id="jobs" data-index="03 / JOBS">
            <h2>Application Links</h2>
            <p className="legacy-callout"><b>{dashboard.target_copy}</b><br /><span>{dashboard.target_copy_cn}</span></p>
            <h3>Open First</h3>
            <div className="legacy-job-groups">{Object.entries(dashboard.job_groups).map(([group, items]) => items.length ? <div className="legacy-job-group" key={group}><h4>{group.split(" / ")[0]}</h4><div className="legacy-pillbox">{items.map((item) => <Pill className="legacy-job-pill" item={item} key={item.url} />)}</div></div> : null)}</div>
            <h3>New Roles</h3>
            <ol className="legacy-feed">{dashboard.jobs.length ? dashboard.jobs.map((job) => <li key={job.link}><a href={job.link} target="_blank" rel="noopener noreferrer">{job.title}</a><p>{job.snippet}</p></li>) : <li>No job results from Brave today.</li>}</ol>
          </section>

          <section className="legacy-content-section" id="links" data-index="04 / ARCHIVE">
            <h2>Reference Links</h2>
            <div className="legacy-quiet-grid">{quietLinks.map((item) => <a className={`legacy-quiet-card ${item.kind} brand-${identity(item.url).brand}`} href={item.url} key={item.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={item.url} /><em>{item.label}</em><b>{item.title}</b><span>{item.url}</span></a>)}</div>
          </section>
        </div>

        <aside className="legacy-side"><h2>Quick Launch</h2><div className="legacy-quick">{quickActions.map((item) => <a className={`legacy-bigbtn ${item.kind} brand-${identity(item.url).brand}`} href={item.url} key={`${item.title}-${item.url}`} target="_blank" rel="noopener noreferrer"><LinkIcon url={item.url} /><b>{item.title}</b><span>{item.subtitle}</span></a>)}</div></aside>
      </div>
    </main>
  );
}
