import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { loadTodos, saveTodo } from "../api";
import { BrandGlyph, brandIdentity } from "../components/BrandLogo";
import { priorityResources } from "../resources";
import type { DashboardLink, DashboardSnapshot, DigestItem, QuickAction, QuietLink } from "../types";

type Props = { dashboard: DashboardSnapshot };

const identity = brandIdentity;

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

  const quickActions = useMemo<QuickAction[]>(() => dashboard.quick_actions.length ? dashboard.quick_actions : priorityResources.map((resource) => ({
    title: resource.title, subtitle: resource.subtitle, url: resource.url, kind: resource.accent === "red" ? "hot" : resource.accent,
  })), [dashboard.quick_actions]);

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
          <p className="legacy-eyebrow">Personal operating system // {dashboard.date || "TODAY"}</p>
          <h1>Daily<br /><span>Control</span></h1>
          <p className="legacy-hero-lede">把今天真正要做的事情放到同一个控制台：先完成 Calendar，再推进投递，最后沿着本周路线学习。</p>
          <div className="legacy-hero-actions" aria-label="Primary actions">
            <Link className="legacy-primary-action solve" to="/neetcode"><span>01</span><b>去刷题</b><small>NEETCODE 150 →</small></Link>
            <Link className="legacy-primary-action learn" to="/learn"><span>02</span><b>去学习</b><small>REACT + TYPESCRIPT →</small></Link>
            <Link className="legacy-primary-action discover" to="/discover"><span>03</span><b>看活动</b><small>NEWS + EVENTS →</small></Link>
          </div>
          <p className="legacy-hero-meta">Generated {dashboard.generated_at ? dashboard.generated_at.replace("T", " ").slice(0, 16) : "waiting for first sync"} · <a href="https://www.notion.so/35ea5189545c80cfa8c3c910e0265817?source=copy_link" target="_blank" rel="noopener noreferrer">Notion / 变得更强</a>{dashboard.weekly_plan.url && <> · <a href={dashboard.weekly_plan.url} target="_blank" rel="noopener noreferrer">{dashboard.weekly_plan.title}</a></>}</p>
        </div>
        <div className="legacy-hero-readout">
          <div className="legacy-metrics">
            <div className="legacy-metric"><b>{dashboard.metrics.calendar_events.toString().padStart(2, "0")}</b><span>Calendar events</span></div>
            <div className="legacy-metric"><b>{dashboard.metrics.notion_tasks.toString().padStart(2, "0")}</b><span>Notion tasks</span></div>
            <div className="legacy-metric"><b>{dashboard.metrics.fresh_jobs.toString().padStart(2, "0")}</b><span>Fresh jobs</span></div>
          </div>
          <div className="legacy-priority"><div><b>01 / Ship</b><span>按 Calendar 做，不空刷网页</span></div><div><b>02 / Apply</b><span>2027 NG + internship / co-op</span></div><div><b>03 / Learn</b><span>NeetCode + current week plan</span></div></div>
          <div className="legacy-status-row">{dashboard.source_status.map((source) => <span className={`legacy-status ${source.ok ? "ok" : "warn"}`} key={source.name}><i>{source.ok ? "●" : "△"}</i><b>{source.name}</b><small>{source.detail}</small></span>)}</div>
        </div>
      </section>

      <div className="legacy-page-grid">
        <div className="legacy-main-column">
          <section className="legacy-content-section" id="today" data-index="01 / TODAY">
            <p className="legacy-section-tag">Execution queue</p><h2>Calendar / 今天该做什么</h2>
            {dashboard.events.length ? dashboard.events.map((event) => <article className={`legacy-event${event.all_day ? " allday" : ""}`} key={event.key}>
              <label className="legacy-check-row"><input type="checkbox" checked={todoState[event.key] ?? false} onChange={() => toggle(event.key, "calendar", event.title, false)} /><span><b>{event.start_time || "All day"}</b> · {event.title}</span></label>
              <div className="legacy-meta">{event.calendar}</div>
              {event.url ? <a className="legacy-btn" href={event.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={event.url} />Open / 开始做</a> : <span className="legacy-no-link">No action link / 无跳转链接</span>}
            </article>) : <p className="legacy-sub">No events today.</p>}
          </section>

          <section className="legacy-content-section" id="plan" data-index="02 / PLAN">
            <p className="legacy-section-tag">Learning trajectory</p><h2>Notion Plan / 学习路线</h2>
            {dashboard.weekly_plan.url && <p><a className="legacy-btn" href={dashboard.weekly_plan.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={dashboard.weekly_plan.url} />Open current week: {dashboard.weekly_plan.title}</a></p>}
            <div className="legacy-digest-grid"><div><h3>Current week checklist</h3><ul>{digest(dashboard.weekly, "notion")}</ul></div><div><h3>变得更强 top notes</h3><ul>{digest(dashboard.notion, "notion")}</ul></div></div>
            <h3>Study links / 学习入口</h3><div className="legacy-pillbox">{dashboard.links.study.map((item) => <Pill item={item} key={item.url} />)}</div>
          </section>

          <section className="legacy-content-section" id="jobs" data-index="03 / JOBS">
            <p className="legacy-section-tag">Opportunity radar</p><h2>Job Hunt / 投简历入口</h2>
            <p className="legacy-callout"><b>{dashboard.target_copy}</b><br /><span>{dashboard.target_copy_cn}</span></p>
            <h3>Open these first / 先打开这些</h3>
            <div className="legacy-job-groups">{Object.entries(dashboard.job_groups).map(([group, items]) => items.length ? <div className="legacy-job-group" key={group}><h4>{group}</h4><div className="legacy-pillbox">{items.map((item) => <Pill className="legacy-job-pill" item={item} key={item.url} />)}</div></div> : null)}</div>
            <h3>Fresh-ish openings scan / 最近岗位扫描</h3>
            <ol className="legacy-feed">{dashboard.jobs.length ? dashboard.jobs.map((job) => <li key={job.link}><a href={job.link} target="_blank" rel="noopener noreferrer">{job.title}</a><p>{job.snippet}</p></li>) : <li>No job results from Brave today.</li>}</ol>
          </section>

          <section className="legacy-content-section" id="links" data-index="04 / ARCHIVE">
            <p className="legacy-section-tag">Utility archive</p><h2>Lower Priority / 低优先级链接</h2><p className="legacy-sub">需要时再打开。Jobs · Study · Infra · Billing · Ideas · Profile · Research。</p>
            <div className="legacy-quiet-grid">{quietLinks.map((item) => <a className={`legacy-quiet-card ${item.kind} brand-${identity(item.url).brand}`} href={item.url} key={item.url} target="_blank" rel="noopener noreferrer"><LinkIcon url={item.url} /><em>{item.label}</em><b>{item.title}</b><span>{item.url}</span></a>)}</div>
          </section>
        </div>

        <aside className="legacy-side"><p className="legacy-section-tag">Quick launch</p><h2>Start Here</h2><p className="legacy-side-copy">高频入口 / click one thing and act</p><div className="legacy-quick">{quickActions.map((item) => <a className={`legacy-bigbtn ${item.kind} brand-${identity(item.url).brand}`} href={item.url} key={`${item.title}-${item.url}`} target="_blank" rel="noopener noreferrer"><LinkIcon url={item.url} /><b>{item.title}</b><span>{item.subtitle}</span></a>)}</div></aside>
      </div>
      <div className="legacy-marquee" aria-hidden="true"><span>calendar synchronized / notion loaded / opportunity radar active / neetcode linked / ship one thing today / calendar synchronized / notion loaded / opportunity radar active / neetcode linked / ship one thing today /</span></div>
    </main>
  );
}
